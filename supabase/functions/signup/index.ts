/**
 * signup
 *
 * Dos puertas de entrada:
 *  - "independiente": crea su propia inmobiliaria y queda como DUENO.
 *  - "invitado": canjea un token de la tabla `invitaciones`.
 *
 * REGLA CENTRAL: en el caso invitado, `inmobiliaria_id`, `rol` y `asiste_a`
 * salen SIEMPRE de la fila de invitaciones. Si el cliente los manda en el body,
 * se descartan sin mirarlos.
 *
 * El profile lo crea el trigger handle_new_user a partir del user_metadata.
 *
 * Es una función pública: hay que deployarla con verify_jwt = false
 * (ya configurado en supabase/config.toml).
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, anonClient, hayCupo, type RolAgente } from '../_shared/supabase.ts'

interface DatosPersonales {
  email: string
  password: string
  nombre: string
  apellido: string
}

interface InvitacionRow {
  id: string
  inmobiliaria_id: string
  rol: RolAgente
  asiste_a: string | null
  usado: boolean
  expira_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return errorResponse(req, 'El cuerpo del request no es JSON válido', 400, 'JSON_INVALIDO')
  }

  const datos = parseDatosPersonales(body)
  if ('error' in datos) {
    return errorResponse(req, datos.error, 400, 'INPUT_INVALIDO')
  }

  try {
    const tipo = body.tipo
    if (tipo === 'independiente') {
      return await signupIndependiente(req, body, datos)
    }
    if (tipo === 'invitado') {
      return await signupInvitado(req, body, datos)
    }
    return errorResponse(
      req,
      "El campo 'tipo' debe ser 'independiente' o 'invitado'",
      400,
      'INPUT_INVALIDO',
    )
  } catch (err) {
    console.error('signup: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})

// ---------------------------------------------------------------------------
// Puerta 1: independiente
// ---------------------------------------------------------------------------

async function signupIndependiente(
  req: Request,
  body: Record<string, unknown>,
  datos: DatosPersonales,
): Promise<Response> {
  const nombreInmobiliaria =
    typeof body.nombre_inmobiliaria === 'string' ? body.nombre_inmobiliaria.trim() : ''
  if (!nombreInmobiliaria) {
    return errorResponse(req, 'Falta el nombre de la inmobiliaria', 400, 'INPUT_INVALIDO')
  }

  const admin = adminClient()

  const { data: inmobiliaria, error: inmoError } = await admin
    .from('inmobiliarias')
    .insert({ nombre: nombreInmobiliaria })
    .select('id')
    .single<{ id: string }>()

  if (inmoError || !inmobiliaria) {
    console.error('signup: no se pudo crear la inmobiliaria', inmoError)
    return errorResponse(req, 'No se pudo crear la inmobiliaria', 500, 'ERROR_INTERNO')
  }

  const creado = await crearUsuario(admin, datos, {
    inmobiliaria_id: inmobiliaria.id,
    rol: 'DUENO',
    asiste_a: null,
  })

  if ('error' in creado) {
    // Compensación: sin dueño, la inmobiliaria recién creada queda huérfana.
    await admin.from('inmobiliarias').delete().eq('id', inmobiliaria.id)
    return errorResponse(req, creado.error, creado.status, creado.code)
  }

  return await responderConSesion(req, creado.userId, datos)
}

// ---------------------------------------------------------------------------
// Puerta 2: invitado
// ---------------------------------------------------------------------------

async function signupInvitado(
  req: Request,
  body: Record<string, unknown>,
  datos: DatosPersonales,
): Promise<Response> {
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return errorResponse(req, 'Falta el token de invitación', 400, 'INPUT_INVALIDO')
  }

  const admin = adminClient()

  // --- a. Buscar la invitación ---------------------------------------------
  const { data: invitacion, error: invError } = await admin
    .from('invitaciones')
    .select('id, inmobiliaria_id, rol, asiste_a, usado, expira_at')
    .eq('token', token)
    .maybeSingle<InvitacionRow>()

  if (invError) {
    console.error('signup: error leyendo la invitación', invError)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }

  // --- b/c. Validar, con mensaje distinto por caso -------------------------
  if (!invitacion) {
    return errorResponse(
      req,
      'La invitación no existe. Pedí un link nuevo a tu inmobiliaria.',
      400,
      'INVITACION_NO_EXISTE',
    )
  }
  if (invitacion.usado) {
    return errorResponse(
      req,
      'Esta invitación ya fue usada. Pedí un link nuevo a tu inmobiliaria.',
      400,
      'INVITACION_YA_USADA',
    )
  }
  if (new Date(invitacion.expira_at).getTime() <= Date.now()) {
    return errorResponse(
      req,
      'La invitación venció. Pedí un link nuevo a tu inmobiliaria.',
      400,
      'INVITACION_VENCIDA',
    )
  }

  // --- d/e. Re-validar cupo al momento del canje ---------------------------
  // Puede haberse llenado entre que se generó el link y se usó.
  const cupo = await hayCupo(admin, invitacion.inmobiliaria_id)
  if (!cupo.ok) {
    return errorResponse(
      req,
      `La inmobiliaria alcanzó el límite de usuarios de su plan (${cupo.usados}/${cupo.limite})`,
      403,
      'SIN_CUPO',
    )
  }

  // --- f. Crear el usuario con los datos DE LA INVITACIÓN ------------------
  const creado = await crearUsuario(admin, datos, {
    inmobiliaria_id: invitacion.inmobiliaria_id,
    rol: invitacion.rol,
    asiste_a: invitacion.asiste_a,
  })

  if ('error' in creado) {
    return errorResponse(req, creado.error, creado.status, creado.code)
  }

  // --- g. Marcar la invitación como usada ----------------------------------
  // El `.eq('usado', false)` hace el canje atómico: si dos personas usan el
  // mismo link a la vez, sólo una actualiza filas.
  const { data: marcadas, error: updateError } = await admin
    .from('invitaciones')
    .update({ usado: true, usado_por: creado.userId })
    .eq('id', invitacion.id)
    .eq('usado', false)
    .select('id')

  if (updateError || !marcadas || marcadas.length === 0) {
    // Perdimos la carrera (o falló el update): deshacemos el alta del usuario
    // para no dejar una cuenta sin invitación asociada.
    await admin.auth.admin.deleteUser(creado.userId)
    console.error('signup: no se pudo marcar la invitación', updateError)
    return errorResponse(
      req,
      'Esta invitación ya fue usada. Pedí un link nuevo a tu inmobiliaria.',
      400,
      'INVITACION_YA_USADA',
    )
  }

  return await responderConSesion(req, creado.userId, datos)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDatosPersonales(
  body: Record<string, unknown>,
): DatosPersonales | { error: string } {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const apellido = typeof body.apellido === 'string' ? body.apellido.trim() : ''

  if (!email || !email.includes('@')) return { error: 'Email inválido' }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }
  if (!nombre) return { error: 'Falta el nombre' }
  if (!apellido) return { error: 'Falta el apellido' }

  return { email, password, nombre, apellido }
}

interface MetadataPerfil {
  inmobiliaria_id: string
  rol: RolAgente
  asiste_a: string | null
}

type ResultadoAlta =
  | { userId: string }
  | { error: string; status: number; code: 'EMAIL_YA_REGISTRADO' | 'ERROR_INTERNO' }

async function crearUsuario(
  // deno-lint-ignore no-explicit-any
  admin: any,
  datos: DatosPersonales,
  perfil: MetadataPerfil,
): Promise<ResultadoAlta> {
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: {
      inmobiliaria_id: perfil.inmobiliaria_id,
      rol: perfil.rol,
      asiste_a: perfil.asiste_a,
      nombre: datos.nombre,
      apellido: datos.apellido,
    },
  })

  if (error || !data?.user) {
    const yaExiste =
      error?.code === 'email_exists' ||
      /already.*registered|already been registered/i.test(error?.message ?? '')
    if (yaExiste) {
      return {
        error: 'Ya existe una cuenta con ese email',
        status: 400,
        code: 'EMAIL_YA_REGISTRADO',
      }
    }
    console.error('signup: createUser falló', error)
    return { error: 'No se pudo crear el usuario', status: 500, code: 'ERROR_INTERNO' }
  }

  return { userId: data.user.id }
}

/**
 * Devuelve { user_id, session }.
 *
 * El service role key no puede emitir sesiones de usuario, así que la sesión se
 * obtiene con el anon key haciendo el password grant del usuario recién creado.
 * Si ese paso falla, el alta igual fue exitosa: devolvemos session: null y el
 * frontend manda al login.
 */
async function responderConSesion(
  req: Request,
  userId: string,
  datos: DatosPersonales,
): Promise<Response> {
  const { data, error } = await anonClient().auth.signInWithPassword({
    email: datos.email,
    password: datos.password,
  })

  if (error) {
    console.error('signup: usuario creado pero no se pudo iniciar sesión', error)
    return jsonResponse(req, { user_id: userId, session: null }, 201)
  }

  return jsonResponse(req, { user_id: userId, session: data.session }, 201)
}
