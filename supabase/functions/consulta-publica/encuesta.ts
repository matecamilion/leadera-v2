/**
 * La encuesta del link de consultas: catálogo de respuestas, rangos de
 * presupuesto y validación del POST.
 *
 * Todo puro, sin red ni base, para poder probarlo con `deno test`.
 *
 * Dos flujos:
 *   - PROPIEDAD: el link es de una propiedad DISPONIBLE. Entra alguien
 *     interesado en ella: la operación sale de `propiedades.finalidad` (si es
 *     AMBAS o no está cargada, se pregunta comprar o alquilar) y el
 *     presupuesto se contesta contra el precio publicado.
 *   - GENERAL: el link general, o el de una propiedad que ya no está
 *     disponible. Cuatro operaciones:
 *       - COMPRA y ALQUILER: alguien que busca (comprador, inquilino).
 *         Compra pregunta forma de pago; alquiler, garantía.
 *       - VENTA y ALQUILER_PROPIETARIO: un propietario que quiere vender o
 *         poner en alquiler lo suyo. Es una captación: se pregunta cuánto
 *         vale (o pretende) y si ya está publicada.
 */

/** COMPRA y ALQUILER no se renombran: hay consultas guardadas con esos valores. */
export const OPERACIONES = ['COMPRA', 'ALQUILER', 'VENTA', 'ALQUILER_PROPIETARIO'] as const
export type Operacion = (typeof OPERACIONES)[number]

/** Lo que se puede preguntar en el link de una propiedad: quien entra está interesado en ella. */
export const OPERACIONES_INTERESADO = ['COMPRA', 'ALQUILER'] as const

export function esPropietario(operacion: Operacion): boolean {
  return operacion === 'VENTA' || operacion === 'ALQUILER_PROPIETARIO'
}

export type Flujo = 'PROPIEDAD' | 'GENERAL'

export const TIPOS_PROPIEDAD = [
  'CASA',
  'DEPARTAMENTO',
  'PH',
  'TERRENO',
  'LOCAL_COMERCIAL',
  'GALPON',
  'OFICINA',
  'OTRO',
] as const
export type TipoPropiedad = (typeof TIPOS_PROPIEDAD)[number]

export const PRESUPUESTO_PROPIEDAD = ['SI', 'UN_POCO_MAS', 'NO'] as const
export type PresupuestoPropiedad = (typeof PRESUPUESTO_PROPIEDAD)[number]

export const PAGOS = [
  'CONTADO',
  'CREDITO_APROBADO',
  'CREDITO_TRAMITE',
  'NECESITA_VENDER',
  'NO_SABE',
] as const
export type Pago = (typeof PAGOS)[number]

export const GARANTIAS = ['PROPIETARIA', 'SEGURO_CAUCION', 'NO_TENGO'] as const
export type Garantia = (typeof GARANTIAS)[number]

export const PLAZOS = ['YA', 'MENOS_3M', '3_6M', 'MAS_6M', 'SOLO_MIRANDO'] as const
export type Plazo = (typeof PLAZOS)[number]

/** Solo propietarios: si ya la tiene publicada, y con quién. */
export const PUBLICACIONES = ['NO', 'LA_PUBLICO_YO', 'UNA_INMOBILIARIA', 'VARIAS'] as const
export type Publicacion = (typeof PUBLICACIONES)[number]

/** Preguntas que el agente puede apagar (`links_consulta.preguntas_off`). */
export type PreguntaOpcional = 'visita' | 'vender' | 'email'

export type Moneda = 'USD' | 'ARS'

export interface RangoPresupuesto {
  codigo: string
  label: string
  /** null = no es un monto ("No sé, quiero una tasación"). */
  moneda: Moneda | null
  /** Para la búsqueda sugerida. null = sin piso / sin techo. */
  min: number | null
  max: number | null
}

const COMPRA_USD: RangoPresupuesto[] = [
  { codigo: 'USD_0_100K', label: 'Hasta USD 100.000', moneda: 'USD', min: null, max: 100_000 },
  { codigo: 'USD_100_150K', label: 'USD 100.000 a 150.000', moneda: 'USD', min: 100_000, max: 150_000 },
  { codigo: 'USD_150_250K', label: 'USD 150.000 a 250.000', moneda: 'USD', min: 150_000, max: 250_000 },
  { codigo: 'USD_250_400K', label: 'USD 250.000 a 400.000', moneda: 'USD', min: 250_000, max: 400_000 },
  { codigo: 'USD_400_700K', label: 'USD 400.000 a 700.000', moneda: 'USD', min: 400_000, max: 700_000 },
  { codigo: 'USD_700K_MAS', label: 'Más de USD 700.000', moneda: 'USD', min: 700_000, max: null },
]

/** Por mes. Los de pesos hay que revisarlos con la inflación (viajan en el GET). */
const ALQUILER_ARS: RangoPresupuesto[] = [
  { codigo: 'ARS_0_500K', label: 'Hasta $500.000', moneda: 'ARS', min: null, max: 500_000 },
  { codigo: 'ARS_500_800K', label: '$500.000 a $800.000', moneda: 'ARS', min: 500_000, max: 800_000 },
  { codigo: 'ARS_800K_1200K', label: '$800.000 a $1.200.000', moneda: 'ARS', min: 800_000, max: 1_200_000 },
  { codigo: 'ARS_1200K_2M', label: '$1.200.000 a $2.000.000', moneda: 'ARS', min: 1_200_000, max: 2_000_000 },
  { codigo: 'ARS_2M_MAS', label: 'Más de $2.000.000', moneda: 'ARS', min: 2_000_000, max: null },
]

const ALQUILER_USD: RangoPresupuesto[] = [
  { codigo: 'USD_0_500', label: 'Hasta USD 500', moneda: 'USD', min: null, max: 500 },
  { codigo: 'USD_500_800', label: 'USD 500 a 800', moneda: 'USD', min: 500, max: 800 },
  { codigo: 'USD_800_1200', label: 'USD 800 a 1.200', moneda: 'USD', min: 800, max: 1_200 },
  { codigo: 'USD_1200_2000', label: 'USD 1.200 a 2.000', moneda: 'USD', min: 1_200, max: 2_000 },
  { codigo: 'USD_2000_MAS', label: 'Más de USD 2.000', moneda: 'USD', min: 2_000, max: null },
]

const TASACION: RangoPresupuesto = {
  codigo: 'TASACION',
  label: 'No sé, quiero una tasación',
  moneda: null,
  min: null,
  max: null,
}

const ASESORAR: RangoPresupuesto = {
  codigo: 'ASESORAR',
  label: 'No sé, quiero que me asesoren',
  moneda: null,
  min: null,
  max: null,
}

/**
 * Rangos del link general, por operación. Viajan en la respuesta del GET: para
 * ajustarlos alcanza con redeployar esta función, sin tocar el front.
 *
 * En los alquileres la persona elige la moneda (Pesos / Dólares) y ve solo
 * los de esa moneda; los dos van en la misma lista.
 */
export const RANGOS_PRESUPUESTO: Record<Operacion, RangoPresupuesto[]> = {
  COMPRA: COMPRA_USD,
  ALQUILER: [...ALQUILER_ARS, ...ALQUILER_USD],
  VENTA: [...COMPRA_USD, TASACION],
  ALQUILER_PROPIETARIO: [...ALQUILER_ARS, ...ALQUILER_USD, ASESORAR],
}

/**
 * Los rangos de la primera versión. Se aceptan en el POST (alguien puede tener
 * la página vieja abierta durante un deploy) y se etiquetan en la bandeja y en
 * la ficha, porque hay consultas guardadas con estos códigos.
 */
const RANGOS_LEGACY: Partial<Record<Operacion, RangoPresupuesto[]>> = {
  COMPRA: [
    { codigo: 'USD_0_50K', label: 'Hasta USD 50.000', moneda: 'USD', min: null, max: 50_000 },
    { codigo: 'USD_50_100K', label: 'USD 50.000 a 100.000', moneda: 'USD', min: 50_000, max: 100_000 },
    { codigo: 'USD_250K_MAS', label: 'Más de USD 250.000', moneda: 'USD', min: 250_000, max: null },
  ],
  ALQUILER: [
    { codigo: 'ARS_0_400K', label: 'Hasta $400.000', moneda: 'ARS', min: null, max: 400_000 },
    { codigo: 'ARS_400_700K', label: '$400.000 a $700.000', moneda: 'ARS', min: 400_000, max: 700_000 },
    { codigo: 'ARS_700K_1M', label: '$700.000 a $1.000.000', moneda: 'ARS', min: 700_000, max: 1_000_000 },
    { codigo: 'ARS_1M_1500K', label: '$1.000.000 a $1.500.000', moneda: 'ARS', min: 1_000_000, max: 1_500_000 },
    { codigo: 'ARS_1500K_MAS', label: 'Más de $1.500.000', moneda: 'ARS', min: 1_500_000, max: null },
  ],
}

/** Válido para esa operación: de los vigentes o de los de la primera versión. */
export function rangoValido(operacion: Operacion, codigo: string): RangoPresupuesto | null {
  return (
    RANGOS_PRESUPUESTO[operacion].find((r) => r.codigo === codigo) ??
    RANGOS_LEGACY[operacion]?.find((r) => r.codigo === codigo) ??
    null
  )
}

/**
 * El monto que puede indicar quien elige un rango abierto ("Más de USD
 * 700.000"): desde el piso del rango hasta este múltiplo del piso.
 */
export const TOPE_MONTO_POR_PISO = 50

/**
 * Límites del monto para ese rango, o null si el rango no lo lleva. Solo los
 * rangos abiertos vigentes, no los de la primera versión: la página vieja no
 * pregunta el monto.
 */
export function limitesMonto(operacion: Operacion, codigo: string): { min: number; max: number } | null {
  const r = RANGOS_PRESUPUESTO[operacion].find((x) => x.codigo === codigo)
  if (!r || r.max !== null || r.moneda === null || r.min === null) return null
  return { min: r.min, max: r.min * TOPE_MONTO_POR_PISO }
}

/** Para etiquetar un código guardado, sea de la operación que sea. */
export function rangoPorCodigo(codigo: string): RangoPresupuesto | null {
  for (const op of OPERACIONES) {
    const r = rangoValido(op, codigo)
    if (r) return r
  }
  return null
}

/** Lo que el servidor sabe del link antes de leer el POST. */
export interface ContextoEncuesta {
  flujo: Flujo
  /** Operación fijada por la propiedad; null = se pregunta. */
  operacionFija: Operacion | null
  preguntasOff: PreguntaOpcional[]
}

export interface RespuestasValidas {
  operacion: Operacion
  tipo_propiedad: TipoPropiedad | null
  zona: string | null
  /** Código de rango (GENERAL) o SI/UN_POCO_MAS/NO (PROPIEDAD). null = no contestó. */
  presupuesto: string | null
  /** Solo con un rango abierto: el monto que indicó. No suma puntos. */
  presupuesto_monto: number | null
  pago: Pago | null
  garantia: Garantia | null
  /** Solo propietarios. */
  publicada: Publicacion | null
  plazo: Plazo
  visita: boolean | null
  vender: boolean | null
}

export interface ContactoValido {
  nombre: string
  apellido: string
  telefono: string
  email: string | null
}

export interface PostValido {
  respuestas: RespuestasValidas
  contacto: ContactoValido
}

const CLAVES_POST = new Set(['token', 'hp', 'consentimiento', 'respuestas', 'contacto'])
const CLAVES_CONTACTO = new Set(['nombre', 'apellido', 'telefono', 'email'])

/**
 * Email: formato razonable y SIN `%`, `*` ni espacios. `%` y `*` son
 * comodines para PostgREST en el `ilike` con el que se buscan duplicados.
 */
const RE_EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string }

function falla(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function textoOpcional(v: unknown, max: number, campo: string): Resultado<string | null> {
  if (v === undefined || v === null) return { ok: true, valor: null }
  if (typeof v !== 'string') return falla(`${campo} tiene que ser texto.`)
  const limpio = v.trim()
  if (limpio.length > max) return falla(`${campo} es demasiado largo.`)
  return { ok: true, valor: limpio || null }
}

function deLista<T extends string>(
  v: unknown,
  lista: readonly T[],
  campo: string,
): Resultado<T> {
  if (typeof v !== 'string' || !(lista as readonly string[]).includes(v)) {
    return falla(`${campo} no es una opción válida.`)
  }
  return { ok: true, valor: v as T }
}

/**
 * Valida el POST contra el contexto del link.
 *
 * Estricto con lo que sobra: una clave que no corresponde a este flujo se
 * rechaza en vez de ignorarse, para que un error de la página se vea en la
 * prueba y no termine guardando respuestas a preguntas que nunca se hicieron.
 *
 * El presupuesto es obligatorio en la página, pero acá se tolera que falte:
 * sin él la consulta se guarda igual y simplemente no pasa sola a leads. Un
 * bug del front no puede hacer perder una consulta.
 *
 * `token` y `hp` no se validan acá: los mira el index antes.
 */
export function validarPost(datos: unknown, ctx: ContextoEncuesta): Resultado<PostValido> {
  if (!esObjeto(datos)) return falla('El cuerpo tiene que ser un objeto JSON.')

  for (const clave of Object.keys(datos)) {
    if (!CLAVES_POST.has(clave)) return falla(`Campo desconocido: ${clave}.`)
  }

  if (datos.consentimiento !== true) return falla('Falta el consentimiento.')

  // --- Respuestas ---------------------------------------------------------
  const r = datos.respuestas
  if (!esObjeto(r)) return falla('Faltan las respuestas.')

  const off = new Set(ctx.preguntasOff)
  const general = ctx.flujo === 'GENERAL'

  // Operación: fija por la propiedad o preguntada.
  let operacion: Operacion
  if (ctx.operacionFija) {
    if (r.operacion !== undefined) return falla('La operación no se pregunta en este link.')
    operacion = ctx.operacionFija
  } else {
    // En el link de una propiedad solo entra alguien interesado en ella.
    const op = deLista(r.operacion, general ? OPERACIONES : OPERACIONES_INTERESADO, 'operacion')
    if (!op.ok) return op
    operacion = op.valor
  }

  const propietario = esPropietario(operacion)

  const permitidas = new Set<string>(['presupuesto', 'plazo'])
  if (!ctx.operacionFija) permitidas.add('operacion')
  if (general) {
    permitidas.add('tipo_propiedad')
    permitidas.add('zona')
    permitidas.add('presupuesto_monto')
    // "¿Tenés una propiedad para vender?" no tiene sentido para quien ya vende.
    if (!propietario && !off.has('vender')) permitidas.add('vender')
  } else if (!off.has('visita')) {
    permitidas.add('visita')
  }
  if (operacion === 'COMPRA') permitidas.add('pago')
  else if (operacion === 'ALQUILER') permitidas.add('garantia')
  else permitidas.add('publicada')

  for (const clave of Object.keys(r)) {
    if (!permitidas.has(clave)) return falla(`La pregunta ${clave} no corresponde a este link.`)
  }

  let tipo_propiedad: TipoPropiedad | null = null
  let zona: string | null = null
  if (general) {
    const tipo = deLista(r.tipo_propiedad, TIPOS_PROPIEDAD, 'tipo_propiedad')
    if (!tipo.ok) return tipo
    tipo_propiedad = tipo.valor

    const z = textoOpcional(r.zona, 60, 'zona')
    if (!z.ok) return z
    zona = z.valor
  }

  let presupuesto: string | null = null
  if (r.presupuesto !== undefined && r.presupuesto !== null) {
    if (general) {
      if (typeof r.presupuesto !== 'string' || !rangoValido(operacion, r.presupuesto)) {
        return falla('presupuesto no es un rango válido para esta operación.')
      }
      presupuesto = r.presupuesto
    } else {
      const p = deLista(r.presupuesto, PRESUPUESTO_PROPIEDAD, 'presupuesto')
      if (!p.ok) return p
      presupuesto = p.valor
    }
  }

  // El monto es opcional y aproximado: si no sirve (fuera de los límites, de
  // otro rango, no entero) se descarta y la consulta sigue igual.
  let presupuesto_monto: number | null = null
  const limites = presupuesto ? limitesMonto(operacion, presupuesto) : null
  const m = r.presupuesto_monto
  if (limites && typeof m === 'number' && Number.isSafeInteger(m) && m >= limites.min && m <= limites.max) {
    presupuesto_monto = m
  }

  let pago: Pago | null = null
  let garantia: Garantia | null = null
  let publicada: Publicacion | null = null
  if (operacion === 'COMPRA') {
    const p = deLista(r.pago, PAGOS, 'pago')
    if (!p.ok) return p
    pago = p.valor
  } else if (operacion === 'ALQUILER') {
    const g = deLista(r.garantia, GARANTIAS, 'garantia')
    if (!g.ok) return g
    garantia = g.valor
  } else {
    const p = deLista(r.publicada, PUBLICACIONES, 'publicada')
    if (!p.ok) return p
    publicada = p.valor
  }

  const plazo = deLista(r.plazo, PLAZOS, 'plazo')
  if (!plazo.ok) return plazo

  let visita: boolean | null = null
  if (permitidas.has('visita')) {
    if (typeof r.visita !== 'boolean') return falla('Falta la respuesta de visita.')
    visita = r.visita
  }

  let vender: boolean | null = null
  if (permitidas.has('vender')) {
    if (typeof r.vender !== 'boolean') return falla('Falta la respuesta de vender.')
    vender = r.vender
  }

  // --- Contacto -----------------------------------------------------------
  const c = datos.contacto
  if (!esObjeto(c)) return falla('Faltan los datos de contacto.')
  for (const clave of Object.keys(c)) {
    if (!CLAVES_CONTACTO.has(clave)) return falla(`Campo de contacto desconocido: ${clave}.`)
  }

  const nombre = textoOpcional(c.nombre, 80, 'nombre')
  if (!nombre.ok) return nombre
  if (!nombre.valor) return falla('Falta el nombre.')

  // Obligatorio: sin apellido, el asesor no distingue a dos "Ana" en la bandeja.
  const apellido = textoOpcional(c.apellido, 80, 'apellido')
  if (!apellido.ok) return apellido
  if (!apellido.valor) return falla('Falta el apellido.')

  if (typeof c.telefono !== 'string') return falla('Falta el teléfono.')
  const telefono = c.telefono.trim()
  if (telefono.length > 40) return falla('El teléfono es demasiado largo.')
  const digitos = telefono.replace(/\D/g, '').length
  if (digitos < 8 || digitos > 13) return falla('El teléfono no parece válido.')

  let email: string | null = null
  if (off.has('email')) {
    if (c.email !== undefined && c.email !== null && c.email !== '') {
      return falla('El email no se pide en este link.')
    }
  } else {
    const e = textoOpcional(c.email, 254, 'email')
    if (!e.ok) return e
    if (e.valor && !RE_EMAIL.test(e.valor)) return falla('El email no parece válido.')
    email = e.valor
  }

  return {
    ok: true,
    valor: {
      respuestas: {
        operacion,
        tipo_propiedad,
        zona,
        presupuesto,
        presupuesto_monto,
        pago,
        garantia,
        publicada,
        plazo: plazo.valor,
        visita,
        vender,
      },
      contacto: { nombre: nombre.valor, apellido: apellido.valor, telefono, email },
    },
  }
}
