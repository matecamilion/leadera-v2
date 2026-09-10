import { supabase } from '../supabase'
import type { TipoInteraccion } from './interacciones'
import type { Lead } from './leads'
import type { EstadoPropiedad, TipoPropiedad } from './propiedades'
import type { Database } from '../../types/database'

/** Cuántos leads se traen por categoría; el resto sale como "+N más". */
export const LEADS_POR_SECCION = 10

/**
 * Límites del día en la zona horaria del navegador.
 *
 * Las tres columnas de fecha son `timestamptz`, así que "hoy" no se puede
 * comparar contra un `YYYY-MM-DD` pelado: hay que acotar contra el intervalo
 * [medianoche de hoy, medianoche de mañana). Se calcula con el reloj local
 * porque el día que le importa al agente es el suyo, no el del server.
 */
export function limitesDelDia(ahora: Date = new Date()): {
  inicioHoy: string
  inicioManana: string
} {
  const inicio = new Date(ahora)
  inicio.setHours(0, 0, 0, 0)

  const manana = new Date(inicio)
  manana.setDate(manana.getDate() + 1)

  return { inicioHoy: inicio.toISOString(), inicioManana: manana.toISOString() }
}

/** Una categoría del día: lo que se muestra más cuántos hay en total. */
export interface SeccionLeads {
  leads: Lead[]
  /** Total real en la base, no `leads.length`. Alimenta el "Ver todos (N)". */
  total: number
}

export interface LeadsDelDia {
  prioritarios: SeccionLeads
  nuevos: SeccionLeads
  seguimientos: SeccionLeads
}

/**
 * Los builders de abajo devuelven tipos internos de PostgREST que cambian
 * entre versiones. Pedimos estructuralmente sólo los métodos que usamos.
 */
interface QueryConOr<Self> {
  or(filtro: string): Self
}

interface QueryDeLeads<Self> extends QueryConOr<Self> {
  is(columna: 'fecha_primer_contacto_real', valor: null): Self
  gte(columna: 'fecha_proximo_seguimiento', valor: string): Self
  lt(columna: 'fecha_proximo_seguimiento', valor: string): Self
}

/**
 * Un lead GANADO ya no es una tarea pendiente.
 *
 * `.neq('estado','GANADO')` solo no alcanza: en SQL `estado <> 'GANADO'` da
 * NULL cuando estado es NULL, y los leads sin clasificar —los más urgentes—
 * quedarían afuera. Mismo criterio que `listarLeads`.
 */
function sinGanados<Q extends QueryConOr<Q>>(query: Q): Q {
  return query.or('estado.is.null,estado.neq.GANADO')
}

// ---------------------------------------------------------------------------
// Los tres predicados que definen las categorías del día.
//
// Viven en funciones y no inline porque definen qué leads son "del día" para
// las tres vistas: las secciones, la barra de progreso y contactados. Copiarlos
// haría que "prioritario" signifique dos cosas distintas en la misma pantalla
// la primera vez que alguien ajuste una copia y se olvide de la otra.
//
// Encadenar dos `.or()` los combina con AND, igual que estaba escrito antes.
// ---------------------------------------------------------------------------

/**
 * Prioritarios: calientes, o con el seguimiento ya vencido. "Vencido" es
 * estrictamente anterior a la medianoche de hoy: lo agendado para hoy es la
 * otra categoría, si no un mismo lead caería en las dos por la hora.
 */
export function soloPrioritarios<Q extends QueryDeLeads<Q>>(query: Q, inicioHoy: string): Q {
  return sinGanados(query).or(`estado.eq.CALIENTE,fecha_proximo_seguimiento.lt.${inicioHoy}`)
}

/**
 * Nuevos: la regla del proyecto es que "nuevo" se define por no haber sido
 * contactado nunca, no por el campo estado.
 */
export function soloNuevos<Q extends QueryDeLeads<Q>>(query: Q): Q {
  return sinGanados(query).is('fecha_primer_contacto_real', null)
}

/** Seguimientos: agendados para hoy, ni vencidos ni futuros. */
export function soloSeguimientosDeHoy<Q extends QueryDeLeads<Q>>(
  query: Q,
  inicioHoy: string,
  inicioManana: string,
): Q {
  return sinGanados(query)
    .gte('fecha_proximo_seguimiento', inicioHoy)
    .lt('fecha_proximo_seguimiento', inicioManana)
}

// ---------------------------------------------------------------------------
// Candidatos del día: la lectura de la que salen las tres pantallas
// ---------------------------------------------------------------------------

/** La interacción con la que se dio por contactado a un lead hoy. */
export interface DetalleInteraccion {
  tipo: TipoInteraccion
  /** `HH:MM` local. */
  hora: string
}

/**
 * Todo lo que el día necesita, sin decidir todavía qué va en cada pantalla.
 *
 * Las tres categorías vienen crudas: sin deduplicar entre sí y sin sacar a los
 * ya contactados. Quién filtra qué se decide más abajo, en las funciones puras
 * que consumen esto, porque las tres vistas necesitan cortes distintos de los
 * mismos leads y hacer el corte en el query obligaría a pedirlos tres veces.
 */
export interface CandidatosDelDia {
  prioritarios: Lead[]
  nuevos: Lead[]
  seguimientos: Lead[]
  /** lead_id → la interacción más reciente que ese lead tuvo hoy. */
  interaccionesDeHoy: Map<string, DetalleInteraccion>
}

/**
 * Los leads del día más las interacciones de hoy, en una sola ida.
 *
 * Se piden todas las filas y no las primeras 10: el recorte a
 * `LEADS_POR_SECCION` lo hace `separarLeadsDelDia` después de sacar a los
 * contactados, porque recortar antes dejaría secciones cortas —diez traídos,
 * tres ya contactados, siete mostrados— y el total del "Ver todos" mentiría.
 *
 * Las interacciones se piden sin acotar por lead: son las de hoy de toda la
 * inmobiliaria, un puñado de filas, y así entra en el mismo `Promise.all` en
 * vez de encadenar una segunda vuelta esperando los ids de la primera.
 *
 * RLS acota todo a la inmobiliaria del usuario; no lo repetimos acá para no
 * dar la impresión de que es el frontend quien protege los datos.
 */
export async function obtenerCandidatosDelDia(): Promise<CandidatosDelDia> {
  const { inicioHoy, inicioManana } = limitesDelDia()

  const [prioritarios, nuevos, seguimientos, interacciones] = await Promise.all([
    soloPrioritarios(supabase.from('leads').select('*'), inicioHoy)
      .order('fecha_proximo_seguimiento', { ascending: true, nullsFirst: false })
      .order('estado', { ascending: true, nullsFirst: true }),

    soloNuevos(supabase.from('leads').select('*')).order('fecha_ingreso', {
      ascending: true,
    }),

    soloSeguimientosDeHoy(
      supabase.from('leads').select('*'),
      inicioHoy,
      inicioManana,
    ).order('fecha_proximo_seguimiento', { ascending: true }),

    supabase
      .from('interacciones')
      .select('lead_id, tipo, fecha')
      .gte('fecha', inicioHoy)
      .lt('fecha', inicioManana)
      .order('fecha', { ascending: false }),
  ])

  const fallo =
    prioritarios.error ?? nuevos.error ?? seguimientos.error ?? interacciones.error
  if (fallo) throw new Error(`No se pudo cargar tu jornada: ${fallo.message}`)

  return {
    prioritarios: prioritarios.data ?? [],
    nuevos: nuevos.data ?? [],
    seguimientos: seguimientos.data ?? [],
    interaccionesDeHoy: ultimaPorLead(interacciones.data ?? []),
  }
}

/**
 * La interacción más reciente de cada lead.
 *
 * Espera las filas ya ordenadas de la más nueva a la más vieja: la primera de
 * cada lead es la última que tuvo, que es la que se muestra.
 */
function ultimaPorLead(
  filas: { lead_id: string; tipo: TipoInteraccion; fecha: string }[],
): Map<string, DetalleInteraccion> {
  const porLead = new Map<string, DetalleInteraccion>()
  for (const fila of filas) {
    if (porLead.has(fila.lead_id)) continue
    porLead.set(fila.lead_id, { tipo: fila.tipo, hora: horaLocal(fila.fecha) })
  }
  return porLead
}

/** `HH:MM` local de un timestamptz. */
function horaLocal(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Las tres secciones de la pantalla principal: sólo lo que queda por hacer.
 *
 * Un lead con una interacción de hoy ya no es trabajo pendiente, así que sale
 * de acá y pasa a la pantalla de contactados. El `total` se cuenta DESPUÉS de
 * ese filtro —es el número del "Ver todos (N)"— y recién ahí se recorta a diez.
 *
 * Las categorías NO son excluyentes entre sí: un lead CALIENTE sin primer
 * contacto aparece como prioritario y como nuevo. Es a propósito —así estaba
 * en el original— porque cada sección responde a una pregunta distinta.
 */
export function separarLeadsDelDia(candidatos: CandidatosDelDia): LeadsDelDia {
  const pendiente = (lead: Lead) => !candidatos.interaccionesDeHoy.has(lead.id)

  const seccion = (leads: Lead[]): SeccionLeads => {
    const pendientes = leads.filter(pendiente)
    return { leads: pendientes.slice(0, LEADS_POR_SECCION), total: pendientes.length }
  }

  return {
    prioritarios: seccion(candidatos.prioritarios),
    nuevos: seccion(candidatos.nuevos),
    seguimientos: seccion(candidatos.seguimientos),
  }
}

// ---------------------------------------------------------------------------
// Progreso del día
// ---------------------------------------------------------------------------

/** Por qué un lead entra en la lista de "a contactar hoy". */
export type MotivoContacto = 'PRIORITARIO' | 'NUEVO' | 'SEGUIMIENTO'

export interface LeadAContactar {
  lead: Lead
  motivo: MotivoContacto
  /** La más reciente de hoy, o null si todavía no se lo contactó. */
  interaccionDeHoy: DetalleInteraccion | null
}

/**
 * Cuando un lead cae en varias categorías, con cuál se lo cuenta.
 *
 * Las secciones los tratan como no excluyentes a propósito (un caliente sin
 * primer contacto sale en dos), pero para el progreso cada lead es una sola
 * cosa por hacer: contactarlo. Se queda con el motivo más urgente.
 */
const PRIORIDAD_MOTIVO: MotivoContacto[] = ['PRIORITARIO', 'NUEVO', 'SEGUIMIENTO']

/**
 * Los leads que había que contactar hoy, deduplicados y con la interacción de
 * hoy si ya la tienen.
 *
 * A diferencia de `separarLeadsDelDia`, acá NO se saca a los contactados: son
 * justamente los que cuentan como completados en la barra.
 */
export function deduplicarAContactar(candidatos: CandidatosDelDia): LeadAContactar[] {
  const porCategoria: Record<MotivoContacto, Lead[]> = {
    PRIORITARIO: candidatos.prioritarios,
    NUEVO: candidatos.nuevos,
    SEGUIMIENTO: candidatos.seguimientos,
  }

  // Se recorre en orden de prioridad, así el primero que reclama un id gana.
  const porId = new Map<string, LeadAContactar>()
  for (const motivo of PRIORIDAD_MOTIVO) {
    for (const lead of porCategoria[motivo]) {
      if (porId.has(lead.id)) continue
      porId.set(lead.id, {
        lead,
        motivo,
        interaccionDeHoy: candidatos.interaccionesDeHoy.get(lead.id) ?? null,
      })
    }
  }

  return [...porId.values()]
}

// ---------------------------------------------------------------------------
// Contactados hoy
// ---------------------------------------------------------------------------

export interface LeadContactado {
  lead: Lead
  interaccion: DetalleInteraccion
}

/**
 * Los leads con al menos una interacción de hoy, con la más reciente al lado.
 *
 * Arranca de las interacciones y no de filtrar `deduplicarAContactar` por
 * `interaccionDeHoy != null`: contactar un lead puede sacarlo del conjunto de
 * candidatos —el trigger le escribe `fecha_primer_contacto_real` y deja de ser
 * "nuevo", o el formulario le corre el próximo seguimiento a mañana— y esa
 * lista lo perdería justo después de contactarlo, que es cuando tiene que
 * aparecer acá. El cruce con las interacciones es el mismo helper que usa
 * `obtenerCandidatosDelDia`; lo que cambia es de dónde salen los leads.
 */
export async function obtenerContactadosHoy(): Promise<LeadContactado[]> {
  const { inicioHoy, inicioManana } = limitesDelDia()

  const { data: filas, error } = await supabase
    .from('interacciones')
    .select('lead_id, tipo, fecha')
    .gte('fecha', inicioHoy)
    .lt('fecha', inicioManana)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar los contactados de hoy: ${error.message}`)
  }

  const porLead = ultimaPorLead(filas ?? [])
  if (porLead.size === 0) return []

  const { data: leads, error: errorLeads } = await supabase
    .from('leads')
    .select('*')
    .in('id', [...porLead.keys()])

  if (errorLeads) {
    throw new Error(
      `No se pudieron cargar los contactados de hoy: ${errorLeads.message}`,
    )
  }

  return (leads ?? [])
    .flatMap((lead) => {
      const interaccion = porLead.get(lead.id)
      return interaccion ? [{ lead, interaccion }] : []
    })
    // Del contacto más reciente al más viejo: lo último que hiciste, arriba.
    .sort((a, b) => b.interaccion.hora.localeCompare(a.interaccion.hora))
}

// ---------------------------------------------------------------------------
// Coincidencias del día
// ---------------------------------------------------------------------------

export interface CompradorCompatible {
  busquedaId: string
  leadId: string
  nombre: string
  apellido: string | null
  estadoLead: Database['public']['Enums']['estado_lead'] | null
  tipoBuscado: TipoPropiedad | null
  zona: string | null
  precioMin: number | null
  precioMax: number | null
  ambientesMin: number | null
}

export interface CoincidenciaDelDia {
  propiedadId: string
  direccion: string
  zona: string | null
  tipo: TipoPropiedad
  precio: number | null
  moneda: string
  compradores: CompradorCompatible[]
}

interface FilaPropiedad {
  id: string
  inmobiliaria_id: string
  direccion: string
  zona: string | null
  tipo: TipoPropiedad
  precio: number | null
  moneda: string
  estado: EstadoPropiedad
}

interface FilaBusqueda {
  id: string
  inmobiliaria_id: string
  tipo_propiedad: TipoPropiedad | null
  zona: string | null
  precio_min: number | null
  precio_max: number | null
  ambientes_min: number | null
  lead: {
    id: string
    nombre: string
    apellido: string | null
    estado: Database['public']['Enums']['estado_lead'] | null
  } | null
}

/**
 * ¿Le sirve esta propiedad a esta búsqueda?
 *
 * Mismo criterio que `buscarCoincidenciasInternas` de propiedades.ts, movido
 * al cliente porque acá se cruza todo el portfolio de una y no una sola
 * propiedad: hacer un query por propiedad sería N+1.
 *
 *  - `tipo_propiedad` null en la búsqueda = le sirve cualquier tipo
 *  - el precio de la propiedad entra en [precio_min, precio_max], con los
 *    extremos vacíos como "sin límite"
 *  - si la propiedad no tiene precio cargado, el rango no se evalúa
 */
function leSirve(propiedad: FilaPropiedad, busqueda: FilaBusqueda): boolean {
  if (busqueda.tipo_propiedad != null && busqueda.tipo_propiedad !== propiedad.tipo) {
    return false
  }

  if (propiedad.precio != null) {
    if (busqueda.precio_min != null && busqueda.precio_min > propiedad.precio) return false
    if (busqueda.precio_max != null && busqueda.precio_max < propiedad.precio) return false
  }

  return true
}

/**
 * Todas las coincidencias del portfolio, agrupadas por propiedad.
 *
 * SIEMPRE dentro de la inmobiliaria del usuario. RLS ya acota las dos tablas,
 * y además el cruce sólo empareja filas con el mismo `inmobiliaria_id`: es
 * redundante a propósito, para que la garantía sea visible en el código y no
 * dependa de que alguien recuerde cómo está escrita la policy. Esto NO es
 * matching entre agencias; eso necesita un modelo de opt-in que no existe.
 * Si esto se refactoriza, el filtro por inmobiliaria_id tiene que seguir.
 */
export async function obtenerCoincidenciasDelDia(): Promise<CoincidenciaDelDia[]> {
  const [propiedades, busquedas] = await Promise.all([
    supabase
      .from('propiedades')
      .select('id, inmobiliaria_id, direccion, zona, tipo, precio, moneda, estado')
      .eq('estado', 'DISPONIBLE')
      .order('created_at', { ascending: false }),

    supabase
      .from('busquedas')
      .select(
        'id, inmobiliaria_id, tipo_propiedad, zona, precio_min, precio_max, ambientes_min, lead:leads(id, nombre, apellido, estado)',
      )
      .eq('activa', true),
  ])

  const fallo = propiedades.error ?? busquedas.error
  if (fallo) throw new Error(`No se pudieron buscar coincidencias: ${fallo.message}`)

  const filasPropiedades = (propiedades.data ?? []) as unknown as FilaPropiedad[]
  const filasBusquedas = ((busquedas.data ?? []) as unknown as FilaBusqueda[]).filter(
    (b) => b.lead !== null,
  )

  const resultado: CoincidenciaDelDia[] = []

  for (const propiedad of filasPropiedades) {
    const compradores = filasBusquedas
      // ↓ el filtro que no se negocia
      .filter((b) => b.inmobiliaria_id === propiedad.inmobiliaria_id)
      .filter((b) => leSirve(propiedad, b))
      .map((b) => ({
        busquedaId: b.id,
        leadId: b.lead!.id,
        nombre: b.lead!.nombre,
        apellido: b.lead!.apellido,
        estadoLead: b.lead!.estado,
        tipoBuscado: b.tipo_propiedad,
        zona: b.zona,
        precioMin: b.precio_min,
        precioMax: b.precio_max,
        ambientesMin: b.ambientes_min,
      }))

    if (compradores.length === 0) continue

    resultado.push({
      propiedadId: propiedad.id,
      direccion: propiedad.direccion,
      zona: propiedad.zona,
      tipo: propiedad.tipo,
      precio: propiedad.precio,
      moneda: propiedad.moneda,
      compradores,
    })
  }

  return resultado
}
