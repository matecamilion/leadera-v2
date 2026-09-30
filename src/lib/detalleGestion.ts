/**
 * Modelo de gestión: metas y lógica pura del panel de detalle.
 *
 * Sin React ni Supabase: leer y escribir el estado del panel en la URL, mover
 * el período, agrupar las filas por día y armar el desglose. Vive fuera de los
 * `.tsx` para no romper el fast refresh de Vite (un archivo que exporta
 * componentes y constantes a la vez lo desactiva).
 */
import {
  CATEGORIAS_REUNION,
  etiquetaCategoriaReunion,
  etiquetaTipoInteraccion,
  type TipoInteraccion,
} from './api/interacciones'
import type {
  FilaDetalleGestion,
  MetricaGestion,
  PeriodoGestion,
} from './api/modeloGestion'
import { claveDia, desdeClaveDia } from './calendario'

/** Las metas de la semana. Fijas por ahora; más adelante, configurables. */
export const METAS_SEMANALES = { verdes: 15, preListingBuying: 3, nuevosContactos: 1 } as const

/**
 * El ritmo diario de reuniones y visitas: 15 / 7 redondeado, o sea 2. Es la
 * única meta que se lleva al día; prelistings y contactos nuevos son pocos por
 * semana y una meta diaria de 0,4 no le dice nada a nadie.
 */
export const META_DIARIA_VERDES = Math.round(METAS_SEMANALES.verdes / 7)

/** Los anillos, con el nombre que se muestra y la meta semanal de cada uno. */
export const METRICAS: Record<MetricaGestion, { nombre: string; metaSemanal: number }> = {
  verdes: { nombre: 'Reuniones y visitas', metaSemanal: METAS_SEMANALES.verdes },
  pre: { nombre: 'Prelistings / prebuyings', metaSemanal: METAS_SEMANALES.preListingBuying },
  nuevos: { nombre: 'Contactos nuevos', metaSemanal: METAS_SEMANALES.nuevosContactos },
}

const PERIODOS: readonly PeriodoGestion[] = ['dia', 'semana']

// ---------------------------------------------------------------------------
// Estado del panel en la URL: ?detalle=verdes|pre|nuevos&periodo=dia|semana&ref=YYYY-MM-DD
// ---------------------------------------------------------------------------

export interface EstadoPanel {
  metrica: MetricaGestion
  periodo: PeriodoGestion
  /** Un día del período que se mira. Null = el período en curso. */
  referencia: string | null
}

const CLAVE_DIA = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` que existe de verdad (un 2026-02-31 no pasa). */
function esClaveDiaValida(valor: string): boolean {
  return CLAVE_DIA.test(valor) && claveDia(desdeClaveDia(valor)) === valor
}

/**
 * El panel que pide la URL, o null si no pide ninguno.
 *
 * Mismo criterio que los listados: lo que viene de la URL se valida contra su
 * catálogo. Acá cualquier valor inválido deja el panel cerrado en vez de abrir
 * uno a medias; una referencia en el futuro también, porque ese período
 * todavía no tiene nada.
 */
export function leerPanel(params: URLSearchParams, hoy: string): EstadoPanel | null {
  const metrica = params.get('detalle')
  const periodo = params.get('periodo')
  const ref = params.get('ref')

  if (!metrica || !(metrica in METRICAS)) return null
  if (!periodo || !PERIODOS.includes(periodo as PeriodoGestion)) return null
  if (ref !== null && (!esClaveDiaValida(ref) || ref > hoy)) return null

  return { metrica: metrica as MetricaGestion, periodo: periodo as PeriodoGestion, referencia: ref }
}

/** Los params con el panel puesto, o sacado si `estado` es null. El resto se conserva. */
export function escribirPanel(params: URLSearchParams, estado: EstadoPanel | null): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete('detalle')
  nuevos.delete('periodo')
  nuevos.delete('ref')
  if (estado) {
    nuevos.set('detalle', estado.metrica)
    nuevos.set('periodo', estado.periodo)
    if (estado.referencia) nuevos.set('ref', estado.referencia)
  }
  return nuevos
}

// ---------------------------------------------------------------------------
// Fechas: claves `YYYY-MM-DD`, siempre con aritmética en UTC para que el
// horario de verano no mueva un día.
// ---------------------------------------------------------------------------

export function sumarDias(clave: string, dias: number): string {
  const [a, m, d] = clave.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d + dias))
  return fecha.toISOString().slice(0, 10)
}

/** Si hoy cae dentro del período. Las claves se comparan como texto. */
export function esPeriodoActual(inicio: string, fin: string, hoy: string): boolean {
  return inicio <= hoy && hoy <= fin
}

/**
 * La referencia del período siguiente, o null si no hay (el que se mira es el
 * en curso). Si el siguiente es el en curso, la referencia es null: en la URL
 * el período actual va sin `ref`.
 */
export function referenciaSiguiente(
  periodo: PeriodoGestion,
  fin: string,
  hoy: string,
): { referencia: string | null } | null {
  const inicioSiguiente = sumarDias(fin, 1)
  if (inicioSiguiente > hoy) return null
  const finSiguiente = sumarDias(fin, periodo === 'dia' ? 1 : 7)
  return { referencia: hoy <= finSiguiente ? null : inicioSiguiente }
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function ddmm(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/** `YYYY-MM-DD` → "mié 24/09". Parseo local: con `new Date(clave)` sería UTC y
 *  en Argentina caería en el día anterior. */
export function etiquetaDia(clave: string): string {
  const fecha = desdeClaveDia(clave)
  return `${DIAS_CORTOS[fecha.getDay()]} ${ddmm(fecha)}`
}

/** `YYYY-MM-DD` → "Miércoles 24/09", para los encabezados de la lista. */
export function etiquetaDiaLarga(clave: string): string {
  const fecha = desdeClaveDia(clave)
  return `${DIAS_LARGOS[fecha.getDay()]} ${ddmm(fecha)}`
}

/** "hoy mié 30/09", "mar 29/09" o "mié 24/09 → mar 30/09". */
export function etiquetaPeriodo(
  periodo: PeriodoGestion,
  inicio: string,
  fin: string,
  hoy: string,
): string {
  if (periodo === 'dia') return inicio === hoy ? `hoy ${etiquetaDia(inicio)}` : etiquetaDia(inicio)
  return `${etiquetaDia(inicio)} → ${etiquetaDia(fin)}`
}

// `hourCycle: 'h23'` y no `hour12: false`: con este último algunos motores
// escriben la medianoche como "24:00", y abajo se compara contra "00:00".
const FORMATO_HORA_AR = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * La medianoche exacta no es una hora: es "sin hora". Marcar realizada una
 * visita agendada sin horario deja la interacción VISITA fechada a las 00:00
 * de ese día (`momentoDeLaInteraccion` en `lib/api/visitas`). Mostrar "00:00"
 * haría creer que la visita fue a medianoche.
 */
const SIN_HORA = '00:00'

/**
 * La hora de la fila en hora argentina, o null si no tiene.
 *
 * Interacciones y leads traen un `timestamptz` y se formatean con la zona fija,
 * no la del navegador. Las visitas traen `hora` (`time`), que ya es la hora
 * local de la visita y se muestra tal cual.
 */
export function horaDeFila(fila: FilaDetalleGestion): string | null {
  let hora: string | null = null
  if (fila.momento) hora = FORMATO_HORA_AR.format(new Date(fila.momento))
  else if (fila.hora) hora = fila.hora.slice(0, 5)
  return hora === SIN_HORA ? null : hora
}

// ---------------------------------------------------------------------------
// Lista y desglose
// ---------------------------------------------------------------------------

export interface GrupoDia {
  dia: string
  filas: FilaDetalleGestion[]
}

/** Las filas por día, en el orden en que vienen (la base ya las ordena). */
export function agruparPorDia(filas: FilaDetalleGestion[]): GrupoDia[] {
  const grupos: GrupoDia[] = []
  for (const fila of filas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === fila.dia) ultimo.filas.push(fila)
    else grupos.push({ dia: fila.dia, filas: [fila] })
  }
  return grupos
}

export interface ParteDesglose {
  etiqueta: string
  valor: number
  /** Las reuniones abiertas por categoría. */
  subpartes?: ParteDesglose[]
}

const ORIGENES_CORTOS: Record<string, string> = { REFERIDO: 'Referido', MANUAL: 'Manual' }

/**
 * El desglose del número, contado sobre las mismas filas de la lista.
 *
 * Verdes: reuniones (abiertas por categoría, con "Sin clasificar") y visitas,
 * que son las interacciones VISITA más las visitas realizadas sin lead.
 */
export function calcularDesglose(
  metrica: MetricaGestion,
  filas: FilaDetalleGestion[],
): ParteDesglose[] {
  const contar = (condicion: (f: FilaDetalleGestion) => boolean) => filas.filter(condicion).length

  if (metrica === 'verdes') {
    const reuniones = filas.filter((f) => f.tipo === 'REUNION')
    const subpartes: ParteDesglose[] = CATEGORIAS_REUNION.map((c) => ({
      etiqueta: c.label,
      valor: reuniones.filter((f) => f.categoria === c.valor).length,
    }))
    subpartes.push({
      etiqueta: 'Sin clasificar',
      valor: reuniones.filter((f) => f.categoria === null).length,
    })
    return [
      { etiqueta: 'Reuniones', valor: reuniones.length, subpartes: subpartes.filter((s) => s.valor > 0) },
      { etiqueta: 'Visitas', valor: filas.length - reuniones.length },
    ]
  }

  if (metrica === 'pre') {
    return [
      { etiqueta: 'Prelisting', valor: contar((f) => f.categoria === 'PRELISTING') },
      { etiqueta: 'Prebuying', valor: contar((f) => f.categoria === 'PREBUYING') },
    ]
  }

  return [
    { etiqueta: 'Referido', valor: contar((f) => f.lead_origen === 'REFERIDO') },
    { etiqueta: 'Manual', valor: contar((f) => f.lead_origen === 'MANUAL') },
  ]
}

export interface PresentacionFila {
  /** Nombre del lead, dirección de la propiedad o el aviso de que no se puede leer. */
  titulo: string
  /** False cuando la RLS no deja leer el lead o la propiedad: sin link. */
  disponible: boolean
  ruta: string | null
  /** La línea de abajo: tipo, categoría, hora. Sin vacíos. */
  partes: string[]
}

/**
 * Qué se muestra de cada fila. Nunca se descarta ninguna: si el lead o la
 * propiedad no se pueden leer, la fila sale igual con un aviso y sin link,
 * porque cuenta en el anillo.
 */
export function presentarFila(fila: FilaDetalleGestion): PresentacionFila {
  const hora = horaDeFila(fila)

  if (fila.fuente === 'visita') {
    if (!fila.propiedad_direccion) {
      return {
        titulo: 'Visita · propiedad no disponible',
        disponible: false,
        ruta: null,
        partes: hora ? [hora] : [],
      }
    }
    return {
      titulo: fila.propiedad_direccion,
      disponible: true,
      ruta: fila.propiedad_id ? `/propiedades/${fila.propiedad_id}` : null,
      partes: ['Visita sin lead', fila.propiedad_zona, hora].filter((p): p is string => !!p),
    }
  }

  const nombre = fila.lead_nombre
    ? `${fila.lead_nombre} ${fila.lead_apellido ?? ''}`.trim()
    : null
  const titulo = nombre ?? 'Lead no disponible'
  const ruta = nombre && fila.lead_id ? `/leads/${fila.lead_id}` : null

  if (fila.fuente === 'lead') {
    const origen = fila.lead_origen ? (ORIGENES_CORTOS[fila.lead_origen] ?? fila.lead_origen) : null
    return {
      titulo,
      disponible: !!nombre,
      ruta,
      partes: [origen, hora].filter((p): p is string => !!p),
    }
  }

  return {
    titulo,
    disponible: !!nombre,
    ruta,
    partes: [
      fila.tipo ? etiquetaTipoInteraccion(fila.tipo as TipoInteraccion) : null,
      fila.categoria ? etiquetaCategoriaReunion(fila.categoria) : null,
      hora,
    ].filter((p): p is string => !!p),
  }
}
