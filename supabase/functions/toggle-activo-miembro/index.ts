/**
 * toggle-activo-miembro
 *
 * Activa o desactiva a un miembro de la inmobiliaria. Sólo un DUENO puede
 * hacerlo, y sólo sobre gente de su propia inmobiliaria.
 *
 * Desactivar no borra nada: banea al usuario en Auth (no puede volver a
 * loguearse ni refrescar su sesión) y baja `profiles.activo`. Reactivar
 * levanta el baneo y vuelve a subir la bandera.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken, type PerfilBasico } from '../_shared/supabase.ts'

/**
 * Duración del baneo al desactivar.
 *
 * `ban_duration` de supabase-js acepta un número con sufijo de unidad —las
 * válidas son ns, us, ms, s, m, h— y el string 'none' levanta el baneo. No hay
 * un "para siempre", así que se usan 100 años: en la práctica es permanente y
 * se revierte en cualquier momento reactivando al miembro.
 */
const BANEO_LARGO = '876000h'
const SIN_BANEO = 'none'

interface ToggleInput {
  profileId?: unknown
  activo?: unknown
}

interface PerfilObjetivo {
  id: string
  rol: string
  nombre: string
  apellido: string
  inmobiliaria_id: string
  activo: boolean
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

    // --- 2. El caller tiene que ser DUENO --------------------------------
    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, rol, inmobiliaria_id')
      .eq('id', caller.id)
      .single<PerfilBasico>()

    if (perfilError || !perfil) {
      return errorResponse(req, 'No se encontró tu perfil de agente', 403, 'PERFIL_NO_ENCONTRADO')
    }

    if (perfil.rol !== 'DUENO') {
      return errorResponse(
        req,
        'Sólo el dueño de la inmobiliaria puede activar o desactivar miembros',
        403,
        'SIN_PERMISO',
      )
    }

    // --- 3. Input --------------------------------------------------------
    let body: ToggleInput
    try {
      body = await req.json()
    } catch {
      return errorResponse(req, 'El cuerpo del request no es JSON válido', 400, 'JSON_INVALIDO')
    }

    if (typeof body.profileId !== 'string' || !body.profileId) {
      return errorResponse(req, 'Falta el id del miembro', 400, 'INPUT_INVALIDO')
    }
    if (typeof body.activo !== 'boolean') {
      return errorResponse(req, '`activo` tiene que ser true o false', 400, 'INPUT_INVALIDO')
    }
    const { profileId, activo } = body

    // --- 4. El objetivo: existe, es de la misma inmobiliaria, no es DUENO -
    const { data: objetivo } = await admin
      .from('profiles')
      .select('id, rol, nombre, apellido, inmobiliaria_id, activo')
      .eq('id', profileId)
      .maybeSingle<PerfilObjetivo>()

    // Mismo mensaje para "no existe" y "es de otra inmobiliaria": distinguirlos
    // filtraría qué ids existen en el sistema.
    if (!objetivo || objetivo.inmobiliaria_id !== perfil.inmobiliaria_id) {
      return errorResponse(
        req,
        'Ese miembro no pertenece a tu inmobiliaria',
        403,
        'SIN_PERMISO',
      )
    }

    if (objetivo.rol === 'DUENO') {
      return errorResponse(
        req,
        'No se puede desactivar a un dueño de la inmobiliaria',
        400,
        'INPUT_INVALIDO',
      )
    }

    // --- 5. Banear/desbanear en Auth y actualizar el profile -------------
    // Primero Auth: si falla, `activo` no queda mintiendo sobre un usuario que
    // en realidad sí puede entrar.
    const { error: authError } = await admin.auth.admin.updateUserById(objetivo.id, {
      ban_duration: activo ? SIN_BANEO : BANEO_LARGO,
    })

    if (authError) {
      console.error('toggle-activo-miembro: updateUserById falló', authError)
      return errorResponse(
        req,
        'No se pudo cambiar el acceso del miembro',
        500,
        'ERROR_INTERNO',
      )
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ activo })
      .eq('id', objetivo.id)

    if (updateError) {
      console.error('toggle-activo-miembro: update de profiles falló', updateError)
      // Se revierte el baneo para no dejar a alguien sin acceso y marcado como
      // activo, que es el estado más confuso de los dos.
      await admin.auth.admin.updateUserById(objetivo.id, {
        ban_duration: objetivo.activo ? SIN_BANEO : BANEO_LARGO,
      })
      return errorResponse(req, 'No se pudo actualizar el miembro', 500, 'ERROR_INTERNO')
    }

    return jsonResponse(req, {
      id: objetivo.id,
      nombre: objetivo.nombre,
      apellido: objetivo.apellido,
      activo,
    })
  } catch (err) {
    console.error('toggle-activo-miembro: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
