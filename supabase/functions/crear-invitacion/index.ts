/**
 * crear-invitacion
 *
 * Genera un token de invitación para sumar un usuario a la inmobiliaria del
 * caller. Requiere JWT válido y que el caller sea DUENO o AGENTE.
 *
 * El rol y el asiste_a quedan grabados en la fila de `invitaciones`; el signup
 * los lee de ahí y jamás del input del cliente.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import {
  adminClient,
  bearerToken,
  hayCupo,
  mensajeSinCupo,
  type PerfilBasico,
  type RolAgente,
} from '../_shared/supabase.ts'

/** Roles que se pueden invitar. DUENO no: se crea sólo por la puerta "independiente". */
const ROLES_INVITABLES: RolAgente[] = ['AGENTE', 'ASISTENTE']

/** Roles que pueden invitar. Un ASISTENTE no puede sumar gente. */
const ROLES_QUE_INVITAN: RolAgente[] = ['DUENO', 'AGENTE']

/** A quién puede asistir un ASISTENTE. Otro asistente no es un agente. */
const ROLES_ASISTIBLES: RolAgente[] = ['DUENO', 'AGENTE']

interface CrearInvitacionInput {
  rol?: unknown
  asiste_a?: unknown
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
    const caller = userData.user

    // --- 2. Perfil y permisos del caller --------------------------------
    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, rol, inmobiliaria_id')
      .eq('id', caller.id)
      .single<PerfilBasico>()

    if (perfilError || !perfil) {
      return errorResponse(
        req,
        'No se encontró tu perfil de agente',
        403,
        'PERFIL_NO_ENCONTRADO',
      )
    }

    if (!ROLES_QUE_INVITAN.includes(perfil.rol)) {
      return errorResponse(
        req,
        'No tenés permiso para invitar usuarios',
        403,
        'SIN_PERMISO',
      )
    }

    // --- 3. Input --------------------------------------------------------
    let body: CrearInvitacionInput
    try {
      body = await req.json()
    } catch {
      return errorResponse(req, 'El cuerpo del request no es JSON válido', 400, 'JSON_INVALIDO')
    }

    const rol = body.rol
    if (typeof rol !== 'string' || !ROLES_INVITABLES.includes(rol as RolAgente)) {
      return errorResponse(
        req,
        `El rol debe ser uno de: ${ROLES_INVITABLES.join(', ')}`,
        400,
        'INPUT_INVALIDO',
      )
    }
    const rolInvitado = rol as RolAgente

    // Un AGENTE sólo suma asistentes para sí mismo. Sumar otro agente es
    // agrandar el equipo —y el plan que se paga—, y esa es decisión del dueño.
    if (perfil.rol === 'AGENTE' && rolInvitado !== 'ASISTENTE') {
      return errorResponse(
        req,
        'Sólo el dueño puede invitar agentes. Vos podés sumar asistentes para vos.',
        403,
        'SIN_PERMISO',
      )
    }

    let asisteA: string | null = null
    if (rolInvitado === 'ASISTENTE') {
      if (perfil.rol === 'AGENTE') {
        // Se fuerza, no se valida: un AGENTE no elige a quién asiste su
        // invitado. Lo que venga en el body se ignora.
        asisteA = caller.id
      } else if (typeof body.asiste_a !== 'string' || !body.asiste_a) {
        return errorResponse(
          req,
          'Para invitar un ASISTENTE tenés que indicar a qué agente asiste',
          400,
          'INPUT_INVALIDO',
        )
      } else {
        asisteA = body.asiste_a
      }

      // Tiene que ser alguien de la misma inmobiliaria Y que sea agente: un
      // ASISTENTE no puede asistir a otro ASISTENTE. Sin el chequeo de rol, esa
      // cadena rompe el conteo de `max_asistentes_por_agente`, que cuenta
      // asistentes por agente y no sabe qué hacer con uno colgado de otro
      // asistente.
      const { data: asistido } = await admin
        .from('profiles')
        .select('id, rol, inmobiliaria_id')
        .eq('id', asisteA)
        .maybeSingle<{ id: string; rol: RolAgente; inmobiliaria_id: string }>()

      if (!asistido || asistido.inmobiliaria_id !== perfil.inmobiliaria_id) {
        return errorResponse(
          req,
          'El agente asistido no pertenece a tu inmobiliaria',
          400,
          'INPUT_INVALIDO',
        )
      }

      if (!ROLES_ASISTIBLES.includes(asistido.rol)) {
        return errorResponse(
          req,
          'Un asistente sólo puede estar asignado al dueño o a un agente',
          400,
          'INPUT_INVALIDO',
        )
      }
    } else if (body.asiste_a != null) {
      // asiste_a sólo tiene sentido para ASISTENTE: lo ignoramos explícitamente.
      asisteA = null
    }

    // --- 4. Cupo ---------------------------------------------------------
    // Con el rol y el asistido, porque los tres topes del plan se miden
    // distinto según qué entra: total, agentes, y asistentes de ESE agente.
    const cupo = await hayCupo(admin, perfil.inmobiliaria_id, {
      rol: rolInvitado,
      asisteA,
    })
    if (!cupo.ok) {
      return errorResponse(req, mensajeSinCupo(cupo, 'propia'), 403, 'SIN_CUPO')
    }

    // --- 5. Crear la invitación -----------------------------------------
    // `token` y `expira_at` los pone la base (defaults del schema).
    const { data: invitacion, error: insertError } = await admin
      .from('invitaciones')
      .insert({
        inmobiliaria_id: perfil.inmobiliaria_id,
        creado_por: caller.id,
        rol: rolInvitado,
        asiste_a: asisteA,
      })
      .select('token, expira_at')
      .single<{ token: string; expira_at: string }>()

    if (insertError || !invitacion) {
      console.error('crear-invitacion: insert falló', insertError)
      return errorResponse(req, 'No se pudo crear la invitación', 500, 'ERROR_INTERNO')
    }

    const baseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://app.leadera.com.ar'

    return jsonResponse(req, {
      token: invitacion.token,
      link: `${baseUrl}/signup?invite=${encodeURIComponent(invitacion.token)}`,
      expira_at: invitacion.expira_at,
      rol: rolInvitado,
      asiste_a: asisteA,
    })
  } catch (err) {
    console.error('crear-invitacion: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
