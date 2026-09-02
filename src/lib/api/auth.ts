/**
 * Cliente tipado de las Edge Functions de auth.
 *
 * Estas dos funciones son el único camino para crear usuarios: corren con
 * service role y aplican las reglas de negocio (cupo, canje de invitación,
 * rol tomado del token y no del input). Nunca llamar a supabase.auth.signUp()
 * directamente desde el frontend.
 */
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type RolAgente = Database['public']['Enums']['rol_agente']

/** Roles que se pueden invitar. DUENO sale sólo del alta independiente. */
export type RolInvitable = Extract<RolAgente, 'AGENTE' | 'ASISTENTE'>

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Códigos estables devueltos por las Edge Functions. */
export type ApiErrorCode =
  | 'METODO_NO_PERMITIDO'
  | 'JSON_INVALIDO'
  | 'INPUT_INVALIDO'
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'PERFIL_NO_ENCONTRADO'
  | 'SIN_CUPO'
  | 'INVITACION_NO_EXISTE'
  | 'INVITACION_YA_USADA'
  | 'INVITACION_VENCIDA'
  | 'EMAIL_YA_REGISTRADO'
  | 'ERROR_INTERNO'
  | 'ERROR_DE_RED'

/**
 * Error de negocio con código legible por la UI.
 * `message` ya viene redactado para mostrarle al usuario.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(message: string, code: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// signup
// ---------------------------------------------------------------------------

export interface SignupIndependienteInput {
  tipo: 'independiente'
  email: string
  password: string
  nombre: string
  apellido: string
  nombre_inmobiliaria: string
}

export interface SignupInvitadoInput {
  tipo: 'invitado'
  token: string
  email: string
  password: string
  nombre: string
  apellido: string
}

export type SignupInput = SignupIndependienteInput | SignupInvitadoInput

export interface SignupResult {
  user_id: string
  /**
   * Sesión lista para usar. Puede venir null si el alta salió bien pero el
   * login automático falló: en ese caso hay que mandar al usuario al login.
   */
  session: Session | null
}

/**
 * Da de alta un usuario, por cualquiera de las dos puertas.
 *
 * En el caso invitado el rol y el asiste_a los define el token del lado del
 * servidor: mandarlos desde acá no tendría ningún efecto.
 */
export async function signup(input: SignupInput): Promise<SignupResult> {
  return await invokeEdgeFunction<SignupResult>('signup', input)
}

// ---------------------------------------------------------------------------
// crear-invitacion
// ---------------------------------------------------------------------------

export interface CrearInvitacionInput {
  rol: RolInvitable
  /** Obligatorio si rol === 'ASISTENTE'. Debe ser un perfil de la misma inmobiliaria. */
  asiste_a?: string
}

export interface CrearInvitacionResult {
  token: string
  /** Link listo para compartir, ya armado por el backend. */
  link: string
  expira_at: string
  rol: RolInvitable
  asiste_a: string | null
}

/**
 * Genera una invitación para la inmobiliaria del usuario logueado.
 * Requiere sesión activa; falla con SIN_CUPO si el plan está lleno.
 */
export async function crearInvitacion(
  input: CrearInvitacionInput,
): Promise<CrearInvitacionResult> {
  if (input.rol === 'ASISTENTE' && !input.asiste_a) {
    throw new ApiError(
      'Para invitar un ASISTENTE tenés que indicar a qué agente asiste',
      'INPUT_INVALIDO',
    )
  }
  return await invokeEdgeFunction<CrearInvitacionResult>('crear-invitacion', input)
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

interface EdgeErrorBody {
  error?: string
  code?: ApiErrorCode
}

/**
 * Envuelve supabase.functions.invoke y normaliza los errores a ApiError.
 *
 * `functions.invoke` no lanza por status 4xx/5xx de forma uniforme: cuando el
 * body es JSON lo devuelve en `data`, así que revisamos ambos lados.
 */
async function invokeEdgeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T | EdgeErrorBody>(name, {
    body: body as Record<string, unknown>,
  })

  if (error) {
    // FunctionsHttpError trae la respuesta original: intentamos leer el { error, code }.
    const parsed = await parseFunctionError(error)
    if (parsed) throw new ApiError(parsed.message, parsed.code)
    throw new ApiError(
      error.message || 'No se pudo conectar con el servidor',
      'ERROR_DE_RED',
    )
  }

  if (isEdgeError(data)) {
    throw new ApiError(data.error, data.code ?? 'ERROR_INTERNO')
  }

  return data as T
}

function isEdgeError(data: unknown): data is { error: string; code?: ApiErrorCode } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'string'
  )
}

async function parseFunctionError(
  error: unknown,
): Promise<{ message: string; code: ApiErrorCode } | null> {
  const response = (error as { context?: unknown }).context
  if (!(response instanceof Response)) return null

  try {
    const body = (await response.clone().json()) as EdgeErrorBody
    if (typeof body.error === 'string') {
      return { message: body.error, code: body.code ?? 'ERROR_INTERNO' }
    }
  } catch {
    // El body no era JSON: caemos al mapeo por status.
  }

  // El gateway de Supabase rechaza los requests sin JWT antes de que corra
  // nuestro código, y responde con su propio formato ({ code, message }).
  if (response.status === 401 || response.status === 403) {
    return { message: 'Tu sesión expiró. Volvé a iniciar sesión.', code: 'NO_AUTENTICADO' }
  }

  return null
}
