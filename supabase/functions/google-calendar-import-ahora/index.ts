/**
 * google-calendar-import-ahora
 *
 * El botón "Actualizar" del calendario: importa YA los eventos del Google
 * Calendar del usuario, en vez de esperar al cron de 3 minutos
 * (`google-calendar-import`, que sigue como está).
 *
 * Auth: JWT de usuario. La cuenta a importar la resuelve el servidor (dueño o
 * agente: la propia; asistente: la de su agente). El body no se lee.
 * Reutiliza `importarCuenta` del cron: mismas reglas, mismo índice único contra
 * duplicados. 15 s de enfriamiento por cuenta.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 */
import { adminClient } from '../_shared/supabase.ts'
import type { PerfilCalendario } from '../_shared/equipoCalendario.ts'
import { importarCuenta } from '../google-calendar-import/importar.ts'
import { crearHandler } from './handler.ts'
import type { CuentaLeida } from './logica.ts'

const admin = adminClient()

Deno.serve(
  crearHandler({
    async usuarioDeToken(token) {
      const { data, error } = await admin.auth.getUser(token)
      return error || !data?.user ? null : { id: data.user.id }
    },

    async leerPerfil(id) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, rol, activo, asiste_a, inmobiliaria_id')
        .eq('id', id)
        .maybeSingle<PerfilCalendario>()
      if (error) throw error
      return data
    },

    async leerCuenta(duenoCalendario) {
      const { data, error } = await admin
        .from('google_calendar_tokens')
        .select(
          'id, agente_id, access_token, refresh_token, token_expiry, google_calendar_id, sync_token, importacion_activa, importacion_fallos_seguidos, importacion_ultima_at, conectado',
        )
        .eq('agente_id', duenoCalendario)
        .maybeSingle<CuentaLeida>()
      if (error) throw error
      return data
    },

    importar: (cuenta) => importarCuenta(admin, cuenta),
    ahora: () => Date.now(),
  }),
)
