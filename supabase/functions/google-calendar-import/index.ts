/**
 * google-calendar-import
 *
 * Fase 2: trae a LeadEra los eventos que el agente crea directo en su Google
 * Calendar. La dirección inversa a `google-calendar-sync`.
 *
 * La dispara un cron (ver la migración `..._google_calendar_importacion_cron`)
 * con la service role key. No la llama el frontend.
 *
 * Sólo procesa las cuentas con `importacion_activa = true`. La bandera arranca
 * apagada a propósito (ver la migración `..._importacion_opt_in`): la primera
 * corrida de una cuenta trae todo su calendario de los próximos 90 días,
 * incluida su agenda personal, así que eso se prende cuenta por cuenta.
 *
 * Por cada cuenta con `conectado = true` e `importacion_activa = true`:
 *   1. Lista eventos: con `sync_token` sólo lo cambiado desde la última vez;
 *      sin él, desde hoy hasta IMPORTAR_DIAS días adelante.
 *   2. Descarta lo que no se importa (ver `motivoParaSaltear`), en especial lo
 *      que creó LeadEra: por la marca de origen y, como segunda red, porque el
 *      `google_event_id` ya existe para ese agente.
 *   3. De una serie recurrente entra UNA sola fila, la primera ocurrencia: un
 *      "Gym" de todos los días son 90 eventos en la ventana inicial y 90 tareas
 *      no son una agenda, son ruido.
 *   4. "Visita: <dirección>" con match fuerte contra una propiedad → visita.
 *      Todo lo demás → tarea. Lead siempre vacío: lo completa el agente.
 *   5. Guarda el `nextSyncToken` sólo si todo lo leído se procesó bien; si algo
 *      falló, la corrida siguiente vuelve a leer lo mismo y el índice único
 *      (asignado_a, google_event_id) evita duplicar lo que ya entró.
 *
 * Una cuenta que falla no frena a las demás.
 *
 * Entrada opcional: `{ "agente_id": "<uuid>" }` limita la corrida a una sola
 * cuenta. Es para probar a mano sin tocar las cuentas reales.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 *
 * La lógica por cuenta vive en `importar.ts`; el botón "Actualizar" usa la misma
 * desde `google-calendar-import-ahora`.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { esAsistente, rolesDeUsuarios } from '../_shared/permisosGoogle.ts'
import { importarCuenta, resumenVacio, type Cuenta, type Resumen } from './importar.ts'

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  // La firma del JWT ya la verificó el gateway (verify_jwt = true): acá sólo se
  // exige que sea la service role y no la sesión de un agente, porque esta
  // función lee y escribe en las cuentas de todos.
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return new Response('forbidden', { status: 403 })
  }

  const entrada = (await req.json().catch(() => ({}))) as { agente_id?: string }
  const admin = adminClient()

  let query = admin
    .from('google_calendar_tokens')
    .select(
      'id, agente_id, access_token, refresh_token, token_expiry, google_calendar_id, sync_token, importacion_activa, importacion_fallos_seguidos',
    )
    .eq('conectado', true)
  if (entrada.agente_id) query = query.eq('agente_id', entrada.agente_id)

  const { data: cuentas, error } = await query
  if (error) {
    // Sin la lista de cuentas no hay nada que hacer; la próxima corrida reintenta.
    console.error('google-calendar-import: no se pudieron leer las cuentas', error)
    return Response.json({ error: 'lectura_cuentas', detalle: error.message }, { status: 500 })
  }

  // Un asistente no tiene calendario propio: lo que importara quedaría a su
  // nombre y el equipo no lo vería como del agente. Se leen los roles de todas
  // las cuentas juntas. Si la lectura falla se corta la corrida y no se importa
  // nada: asumir un rol dejaría pasar justo lo que este filtro frena.
  let roles: Map<string, string>
  try {
    roles = await rolesDeUsuarios(
      admin,
      ((cuentas ?? []) as Cuenta[]).map((c) => c.agente_id),
    )
  } catch (err) {
    console.error('google-calendar-import: no se pudieron leer los roles', err)
    return Response.json(
      { error: 'lectura_roles', detalle: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const resumenes: Resumen[] = []
  // En serie y no en paralelo: son pocas cuentas y así un pico de Google o de
  // la base no se multiplica por la cantidad de agentes.
  for (const cuenta of (cuentas ?? []) as Cuenta[]) {
    // Se ignora sin tocar Google ni la fila (ni sus contadores): queda como
    // está hasta que alguien la limpie. Aparece en el resumen.
    if (esAsistente(roles.get(cuenta.agente_id))) {
      resumenes.push(resumenVacio(cuenta, 'asistente_ignorado'))
      continue
    }

    // Sin opt-in no se toca nada de esa cuenta: ni Google, ni sus contadores de
    // error. Aparece en el resumen para que se vea que existe y está apagada.
    if (!cuenta.importacion_activa) {
      resumenes.push(resumenVacio(cuenta, 'importacion_no_activada'))
      continue
    }
    resumenes.push(await importarCuenta(admin, cuenta))
  }

  return Response.json({ cuentas: resumenes.length, resumenes })
})

function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
