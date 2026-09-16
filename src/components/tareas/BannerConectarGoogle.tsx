import { IconoCalendario } from '../leads/Iconos'
import { useConectarGoogle, useConexionGoogle } from '../../hooks/useGoogleCalendar'

/**
 * Invitación a conectar Google Calendar, arriba del calendario de Tareas.
 *
 * Es una oferta, no una advertencia: nada está roto si el agente no conecta, y
 * la mayoría no va a conectar nunca. Por eso NO usa el vocabulario de alerta de
 * la app —`warm-soft` + `IconoAlerta`, que es lo que usan el trial por vencer y
 * la reconexión pendiente— sino el verde de marca, y por eso no tiene botón de
 * cerrar: no hay nada que descartar, se va solo cuando deja de aplicar.
 *
 * Visualmente es una card más del sistema: mismo `rounded-2xl`, `shadow-sm` y
 * `p-5` que la `Tarjeta` de Perfil. Lo único propio es el fondo `brand-softer`
 * y el borde verde tenue, que lo separan del blanco de las cards de datos sin
 * convertirlo en otra cosa.
 *
 * Reacciona solo al estado de conexión: comparte `CLAVE_GOOGLE_CALENDAR` con el
 * perfil, así que conectar o desconectar desde allá lo hace aparecer y
 * desaparecer sin recargar nada.
 */
export function BannerConectarGoogle() {
  const conexion = useConexionGoogle()
  const conectar = useConectarGoogle()

  // Mientras carga no se muestra nada: asomar el banner medio segundo y
  // esconderlo cuando llega el dato le haría un salto a todo el calendario, y
  // justo al agente que YA conectó, que es a quien menos le importa el aviso.
  if (conexion.isPending) return null

  // Si no se pudo leer el estado, tampoco: ofrecerle conectar a alguien que
  // quizá ya está conectado es peor que no decirle nada. El perfil es el lugar
  // donde ese error se reporta.
  if (conexion.isError) return null

  // Cubre los dos casos en los que no hay sincronización andando: nunca conectó
  // (`null`) y le revocaron el permiso (`conectado: false`). El texto sirve para
  // los dos y el flujo de OAuth es el mismo —`google-oauth-init` manda
  // `prompt=consent`—, así que no hace falta partirlo en dos mensajes.
  if (conexion.data?.conectado === true) return null

  return (
    <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-brand-softer p-5 shadow-sm sm:flex-row sm:items-center">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary"
      >
        <IconoCalendario className="size-6" />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">
          Sincronizá tu agenda con Google Calendar
        </h2>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-3">
          Conectá tu cuenta y tus tareas y visitas van a aparecer automáticamente
          en tu calendario de Google, sin cargar nada dos veces.
        </p>

        {conectar.isError && (
          <p role="alert" className="mt-2 text-[0.85rem] text-peligro-ink">
            {conectar.error.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => conectar.mutate()}
        disabled={conectar.isPending}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {conectar.isPending && (
          <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
        )}
        Conectar Google Calendar
      </button>
    </section>
  )
}
