/**
 * Puntaje de la encuesta y lo que se deriva de él.
 *
 * Puro: se prueba con `deno test`. Los puntos son constantes para poder
 * ajustarlos sin tocar la lógica.
 *
 * La temperatura NO va al lead: el lead nace en estado NULL ("Nuevo") igual que
 * cualquier otro. Acá solo decide si la consulta pasa sola a leads o espera en
 * la bandeja, y se guarda en `consultas` para mostrarla como badge.
 */
import {
  type ContactoValido,
  esPropietario,
  type Flujo,
  type Operacion,
  rangoPorCodigo,
  type RespuestasValidas,
  type TipoPropiedad,
} from './encuesta.ts'

export const PUNTOS = {
  presupuestoPropiedad: { SI: 30, UN_POCO_MAS: 10, NO: -20 },
  /** En el link general no hay precio contra qué comparar: elegir un rango ya es la señal. */
  presupuestoRango: 30,
  pago: { CONTADO: 25, CREDITO_APROBADO: 25, CREDITO_TRAMITE: 10, NECESITA_VENDER: 5, NO_SABE: 0 },
  garantia: { PROPIETARIA: 25, SEGURO_CAUCION: 25, NO_TENGO: 0 },
  /**
   * Propietarios: sin publicar es la mejor señal (puede ser exclusiva); con
   * varias inmobiliarias, la peor. "No sé, quiero una tasación" cuenta como
   * valor respondido: es intención fuerte, no duda.
   */
  publicada: { NO: 25, LA_PUBLICO_YO: 20, UNA_INMOBILIARIA: 10, VARIAS: 5 },
  plazo: { YA: 25, MENOS_3M: 25, '3_6M': 10, MAS_6M: 0, SOLO_MIRANDO: 0 },
  visita: 10,
  email: 5,
} as const

export const UMBRAL_CALIENTE = 60
/** Desde acá pasa sola a leads (si además contestó el presupuesto). */
export const UMBRAL_AUTO = 40

export type Temperatura = 'CALIENTE' | 'TIBIO' | 'FRIO'

/** Lo que se muestra de la propiedad. Nunca la dirección. */
export interface PropiedadPublica {
  tipo: TipoPropiedad
  zona: string | null
  precio: number | null
  moneda: string
}

export interface Calificacion {
  puntaje: number
  temperatura: Temperatura
  presupuestoRespondido: boolean
  autoAceptable: boolean
  posibleCaptacion: boolean
}

export function calificar(
  flujo: Flujo,
  r: RespuestasValidas,
  contacto: ContactoValido,
): Calificacion {
  let puntaje = 0

  if (r.presupuesto) {
    puntaje += flujo === 'PROPIEDAD'
      ? PUNTOS.presupuestoPropiedad[r.presupuesto as keyof typeof PUNTOS.presupuestoPropiedad]
      : PUNTOS.presupuestoRango
  }
  if (r.pago) puntaje += PUNTOS.pago[r.pago]
  if (r.garantia) puntaje += PUNTOS.garantia[r.garantia]
  if (r.publicada) puntaje += PUNTOS.publicada[r.publicada]
  puntaje += PUNTOS.plazo[r.plazo]
  if (r.visita) puntaje += PUNTOS.visita
  if (contacto.email) puntaje += PUNTOS.email

  const presupuestoRespondido = r.presupuesto !== null
  const temperatura: Temperatura = puntaje >= UMBRAL_CALIENTE
    ? 'CALIENTE'
    : puntaje >= UMBRAL_AUTO
    ? 'TIBIO'
    : 'FRIO'

  return {
    puntaje,
    temperatura,
    presupuestoRespondido,
    autoAceptable: presupuestoRespondido && puntaje >= UMBRAL_AUTO,
    // Un propietario que vende o alquila lo suyo es, por definición, una captación.
    posibleCaptacion: esPropietario(r.operacion) || r.pago === 'NECESITA_VENDER' || r.vender === true,
  }
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const ETIQUETA_TIPO: Record<TipoPropiedad, string> = {
  CASA: 'Casa',
  DEPARTAMENTO: 'Departamento',
  PH: 'PH',
  TERRENO: 'Terreno',
  LOCAL_COMERCIAL: 'Local comercial',
  GALPON: 'Galpón',
  OFICINA: 'Oficina',
  OTRO: 'Otro',
}

const ETIQUETA_OPERACION: Record<Operacion, string> = {
  COMPRA: 'Compra',
  ALQUILER: 'Alquiler',
  VENTA: 'Venta de su propiedad (propietario)',
  ALQUILER_PROPIETARIO: 'Alquiler de su propiedad (propietario)',
}

const ETIQUETA_PUBLICADA: Record<string, string> = {
  NO: 'Todavía no la publicó',
  LA_PUBLICO_YO: 'La publica él/ella',
  UNA_INMOBILIARIA: 'Con una inmobiliaria',
  VARIAS: 'Con varias inmobiliarias',
}

const ETIQUETA_PRESUPUESTO_PROPIEDAD: Record<string, string> = {
  SI: 'Sí, entra en su presupuesto',
  UN_POCO_MAS: 'Está un poco por encima de su presupuesto',
  NO: 'No entra en su presupuesto',
}

const ETIQUETA_PAGO: Record<string, string> = {
  CONTADO: 'Contado',
  CREDITO_APROBADO: 'Crédito aprobado',
  CREDITO_TRAMITE: 'Crédito en trámite',
  NECESITA_VENDER: 'Necesita vender primero',
  NO_SABE: 'Todavía no sabe',
}

const ETIQUETA_GARANTIA: Record<string, string> = {
  PROPIETARIA: 'Garantía propietaria',
  SEGURO_CAUCION: 'Seguro de caución',
  NO_TENGO: 'No tiene garantía',
}

const ETIQUETA_PLAZO: Record<string, string> = {
  YA: 'Ya',
  MENOS_3M: 'En menos de 3 meses',
  '3_6M': 'En 3 a 6 meses',
  MAS_6M: 'En más de 6 meses',
  SOLO_MIRANDO: 'Solo está mirando',
}

const ETIQUETA_TEMPERATURA: Record<Temperatura, string> = {
  CALIENTE: 'caliente',
  TIBIO: 'tibia',
  FRIO: 'fría',
}

export function formatearPrecio(precio: number | null, moneda: string): string | null {
  if (precio === null) return null
  const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(precio)
  return moneda === 'ARS' ? `$${numero}` : `${moneda} ${numero}`
}

/** "Más de USD 700.000 (indicó USD 900.000)"; sin monto, solo el label. */
function etiquetaRango(codigo: string, monto: number | null): string | undefined {
  const rango = rangoPorCodigo(codigo)
  if (!rango) return undefined
  const indicado = rango.moneda ? formatearPrecio(monto, rango.moneda) : null
  return indicado ? `${rango.label} (indicó ${indicado})` : rango.label
}

function describirPropiedad(p: PropiedadPublica): string {
  const partes = [ETIQUETA_TIPO[p.tipo]]
  if (p.zona) partes.push(`en ${p.zona}`)
  const precio = formatearPrecio(p.precio, p.moneda)
  return precio ? `${partes.join(' ')} (${precio})` : partes.join(' ')
}

/**
 * Texto legible para `consultas.resumen`, que al aceptar pasa a
 * `leads.descripcion_inicial`.
 *
 * `propiedadOrigen` es la propiedad del link aunque ya no esté disponible;
 * `flujo` dice si se la mostró o se cayó al flujo general.
 */
export function armarResumen(
  flujo: Flujo,
  r: RespuestasValidas,
  cal: Calificacion,
  propiedadOrigen: PropiedadPublica | null,
): string {
  const lineas: string[] = ['Consulta por link de Leadera.']

  if (propiedadOrigen) {
    const desc = describirPropiedad(propiedadOrigen)
    lineas.push(
      flujo === 'PROPIEDAD'
        ? `Consultó por: ${desc}.`
        : `Entró por: ${desc}, que ya no estaba disponible.`,
    )
  }

  lineas.push(`Operación: ${ETIQUETA_OPERACION[r.operacion]}.`)

  const propietario = esPropietario(r.operacion)

  if (flujo === 'GENERAL' && r.tipo_propiedad) {
    const lugar = `${ETIQUETA_TIPO[r.tipo_propiedad]}${r.zona ? ` en ${r.zona}` : ''}`
    lineas.push(propietario ? `Su propiedad: ${lugar}.` : `Busca: ${lugar}.`)
  }

  const etiquetaMonto = r.operacion === 'VENTA'
    ? 'Valor estimado'
    : r.operacion === 'ALQUILER_PROPIETARIO'
    ? 'Pretende'
    : 'Presupuesto'
  if (r.presupuesto) {
    const texto = flujo === 'PROPIEDAD'
      ? ETIQUETA_PRESUPUESTO_PROPIEDAD[r.presupuesto]
      : etiquetaRango(r.presupuesto, r.presupuesto_monto)
    lineas.push(`${etiquetaMonto}: ${texto}.`)
  } else {
    lineas.push(`${etiquetaMonto}: no lo contestó.`)
  }

  if (r.pago) lineas.push(`Pago: ${ETIQUETA_PAGO[r.pago]}.`)
  if (r.garantia) lineas.push(`Garantía: ${ETIQUETA_GARANTIA[r.garantia]}.`)
  if (r.publicada) lineas.push(`Publicada: ${ETIQUETA_PUBLICADA[r.publicada]}.`)
  lineas.push(`Plazo: ${ETIQUETA_PLAZO[r.plazo]}.`)
  if (r.visita !== null) lineas.push(`Quiere coordinar visita: ${r.visita ? 'sí' : 'no'}.`)
  if (r.vender !== null) lineas.push(`Tiene una propiedad para vender: ${r.vender ? 'sí' : 'no'}.`)

  lineas.push(`Encuesta: ${cal.puntaje} pts (${ETIQUETA_TEMPERATURA[cal.temperatura]}).`)

  return lineas.join('\n')
}

// ---------------------------------------------------------------------------
// Búsqueda sugerida
// ---------------------------------------------------------------------------

/** Forma de `consultas.busqueda`, que `consulta_crear_lead` copia a `busquedas`. */
export interface BusquedaSugerida {
  tipo_propiedad: TipoPropiedad | null
  zona: string | null
  precio_min: number | null
  precio_max: number | null
  notas: string
}

/**
 * `busquedas` no tiene moneda ni operación, y las propiedades se publican en
 * USD. Por eso los precios solo se cargan cuando el rango es en USD; si es en
 * pesos, el presupuesto va en `notas`, para no mezclar monedas en el matching.
 *
 * Un propietario no busca nada: devuelve null y no se crea ninguna búsqueda.
 */
export function armarBusqueda(
  flujo: Flujo,
  r: RespuestasValidas,
  propiedad: PropiedadPublica | null,
): BusquedaSugerida | null {
  if (esPropietario(r.operacion)) return null

  const operacion = ETIQUETA_OPERACION[r.operacion]

  if (flujo === 'PROPIEDAD' && propiedad) {
    const entra = r.presupuesto === 'SI' || r.presupuesto === 'UN_POCO_MAS'
    const usdCompra = r.operacion === 'COMPRA' && propiedad.moneda === 'USD'
    return {
      tipo_propiedad: propiedad.tipo,
      zona: propiedad.zona,
      precio_min: null,
      precio_max: usdCompra && entra ? propiedad.precio : null,
      notas: `${operacion} · consultó por ${describirPropiedad(propiedad)} · desde link de consultas`,
    }
  }

  const rango = r.presupuesto ? rangoPorCodigo(r.presupuesto) : null

  // En un rango abierto ("Más de USD 700.000"), el monto que indicó es el techo.
  if (rango?.moneda === 'USD') {
    return {
      tipo_propiedad: r.tipo_propiedad,
      zona: r.zona,
      precio_min: rango?.min ?? null,
      precio_max: rango?.max ?? r.presupuesto_monto,
      notas: `${operacion} · desde link de consultas`,
    }
  }

  const presupuesto = r.presupuesto ? etiquetaRango(r.presupuesto, r.presupuesto_monto) : undefined
  return {
    tipo_propiedad: r.tipo_propiedad,
    zona: r.zona,
    precio_min: null,
    precio_max: null,
    notas: `${operacion} · presupuesto: ${presupuesto ?? 'no lo contestó'} · desde link de consultas`,
  }
}
