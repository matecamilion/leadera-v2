/**
 * verificar-duplicados-importacion
 *
 * Dada una lista de filas (teléfono + email), dice cuáles ya existen en los
 * leads de la inmobiliaria del caller, y cuántos leads usa la cuenta contra el
 * tope de su plan. Es de SOLO LECTURA.
 *
 * Por qué una función y no la RLS: la RLS deja ver a un agente o asistente
 * solo sus leads, y un duplicado puede ser de un compañero. Acá se lee con
 * service role, filtrando SIEMPRE por la inmobiliaria del perfil autenticado
 * (nunca por algo del body), y la respuesta no lleva ni ids ni nombres ni
 * teléfonos de los leads existentes: solo "esta fila ya existe, por teléfono o
 * por email".
 *
 * No se loguea ningún teléfono ni email, ni de la entrada ni de la base.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { armarRespuesta, calcularCupo } from './cupo.ts'
import { type FilaAVerificar, type LeadExistente, verificarDuplicados } from './logica.ts'

const MAX_FILAS = 2000
const MAX_LARGO_TELEFONO = 50
const MAX_LARGO_EMAIL = 254
/** 2.000 filas con los largos máximos pesan ~600 KB; esto corta lo desmedido. */
const MAX_BYTES_BODY = 1_000_000
/** Filas por viaje a la base (el techo de PostgREST es `max_rows = 1000`). */
const TAMANO_PAGINA = 1000
/** Tope de seguridad: 100.000 leads. Una cuenta real está muy lejos. */
const MAX_PAGINAS = 100

interface PerfilCaller {
  id: string
  inmobiliaria_id: string
  activo: boolean
}

/** Valida una fila del body; null si algún campo no cumple. */
function validarFila(valor: unknown): FilaAVerificar | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { fila, telefono, email } = valor as Record<string, unknown>

  if (typeof fila !== 'number' || !Number.isInteger(fila)) return null

  // Ausente cuenta como null: el front manda null, pero no hay por qué ser estrictos.
  const tel = telefono ?? null
  const mail = email ?? null
  if (tel !== null && (typeof tel !== 'string' || tel.length > MAX_LARGO_TELEFONO)) return null
  if (mail !== null && (typeof mail !== 'string' || mail.length > MAX_LARGO_EMAIL)) return null

  return { fila, telefono: tel, email: mail }
}

/** Todos los teléfonos y emails de la inmobiliaria, de a páginas con orden estable. */
async function leerLeadsDeLaCuenta(
  admin: ReturnType<typeof adminClient>,
  inmobiliariaId: string,
): Promise<LeadExistente[]> {
  const existentes: LeadExistente[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * TAMANO_PAGINA
    const { data, error } = await admin
      .from('leads')
      .select('telefono, email')
      .eq('inmobiliaria_id', inmobiliariaId)
      // Sin un orden total, dos páginas pueden repetir o saltearse filas.
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)

    // Solo el mensaje: el error de PostgREST podría traer valores en `details`.
    if (error) throw new Error(`leer leads: ${error.message}`)

    const lote = (data ?? []) as LeadExistente[]
    existentes.push(...lote)
    if (lote.length < TAMANO_PAGINA) return existentes
  }

  throw new Error('leer leads: se superó el tope de páginas')
}

/** Cuántos leads tiene la cuenta, sin traer ninguna fila. */
async function contarLeadsDeLaCuenta(
  admin: ReturnType<typeof adminClient>,
  inmobiliariaId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('inmobiliaria_id', inmobiliariaId)

  if (error) throw new Error(`contar leads: ${error.message}`)
  return count ?? 0
}

/**
 * El tope de leads del plan de la inmobiliaria, o null si no restringe: sin
 * plan, sin fila en `planes_limites_recursos` o con `limite_leads` null (el
 * mismo criterio de `leads_verificar_limite`).
 */
async function leerLimiteDeLeads(
  admin: ReturnType<typeof adminClient>,
  inmobiliariaId: string,
): Promise<number | null> {
  const { data: inmobiliaria, error } = await admin
    .from('inmobiliarias')
    .select('plan')
    .eq('id', inmobiliariaId)
    .maybeSingle<{ plan: string | null }>()

  if (error) throw new Error(`leer plan: ${error.message}`)
  if (!inmobiliaria?.plan) return null

  const { data: limites, error: errorLimites } = await admin
    .from('planes_limites_recursos')
    .select('limite_leads')
    .eq('plan', inmobiliaria.plan)
    .maybeSingle<{ limite_leads: number | null }>()

  if (errorLimites) throw new Error(`leer límites: ${errorLimites.message}`)
  return limites?.limite_leads ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  try {
    const admin = adminClient()

    // --- 1. Autenticación -----------------------------------------------
    const token = bearerToken(req)
    if (!token) {
      return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return errorResponse(req, 'Sesión inválida o expirada', 401, 'NO_AUTENTICADO')
    }

    // --- 2. Perfil: existe y está activo ---------------------------------
    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, inmobiliaria_id, activo')
      .eq('id', userData.user.id)
      .single<PerfilCaller>()

    if (perfilError || !perfil) {
      return errorResponse(req, 'No se encontró tu perfil de agente', 403, 'PERFIL_NO_ENCONTRADO')
    }
    if (!perfil.activo) {
      return errorResponse(req, 'Tu usuario está desactivado', 403, 'SIN_PERMISO')
    }

    // --- 3. Input --------------------------------------------------------
    const texto = await req.text()
    if (texto.length > MAX_BYTES_BODY) {
      return errorResponse(req, 'El pedido es demasiado grande', 400, 'INPUT_INVALIDO')
    }

    let body: unknown
    try {
      body = JSON.parse(texto)
    } catch {
      return errorResponse(req, 'El cuerpo del request no es JSON válido', 400, 'JSON_INVALIDO')
    }

    const crudas = (body as { filas?: unknown } | null)?.filas
    if (!Array.isArray(crudas)) {
      return errorResponse(req, '`filas` tiene que ser una lista', 400, 'INPUT_INVALIDO')
    }
    if (crudas.length > MAX_FILAS) {
      return errorResponse(req, `Máximo ${MAX_FILAS} filas por pedido`, 400, 'INPUT_INVALIDO')
    }

    const filas: FilaAVerificar[] = []
    for (const cruda of crudas) {
      const fila = validarFila(cruda)
      if (!fila) {
        return errorResponse(
          req,
          'Cada fila necesita `fila` (entero), y `telefono` (hasta 50 caracteres) y `email` (hasta 254) como texto o null',
          400,
          'INPUT_INVALIDO',
        )
      }
      filas.push(fila)
    }

    // --- 4. Comparar y medir el cupo -------------------------------------
    // Con filas se leen los leads para compararlos y de ahí sale el conteo; sin
    // filas no hay nada que comparar y alcanza con contarlos. El cupo se
    // devuelve igual: la pantalla lo necesita aunque el archivo no traiga datos
    // para chequear.
    const inmobiliariaId = perfil.inmobiliaria_id

    if (filas.length === 0) {
      const [usados, limite] = await Promise.all([
        contarLeadsDeLaCuenta(admin, inmobiliariaId),
        leerLimiteDeLeads(admin, inmobiliariaId),
      ])
      return jsonResponse(req, armarRespuesta([], calcularCupo(usados, limite)))
    }

    const [existentes, limite] = await Promise.all([
      leerLeadsDeLaCuenta(admin, inmobiliariaId),
      leerLimiteDeLeads(admin, inmobiliariaId),
    ])

    return jsonResponse(
      req,
      armarRespuesta(verificarDuplicados(filas, existentes), calcularCupo(existentes.length, limite)),
    )
  } catch (err) {
    console.error(
      'verificar-duplicados-importacion: error inesperado',
      err instanceof Error ? err.message : 'desconocido',
    )
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
