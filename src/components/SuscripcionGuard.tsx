import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import { estaBloqueada } from '../lib/api/suscripcion'
import { Spinner } from './Spinner'

/** La única pantalla que sigue accesible con la cuenta vencida. */
const RUTA_SUSCRIPCION = '/suscripcion'

/**
 * Corta el acceso cuando la suscripción venció o se canceló.
 *
 * Va entre `ProtectedRoute` y `AppLayout`, no adentro: la pantalla de bloqueo
 * del agente tiene que poder renderizarse sin sidebar ni header, y desde adentro
 * del layout eso sólo se lograría tapándolo con un overlay —que deja la
 * navegación en el DOM, alcanzable por teclado y por lector de pantalla—.
 *
 * `/suscripcion` queda exceptuada por ruta y no por rama del árbol para que el
 * `AppLayout` sea uno solo: separarla en su propio grupo de rutas remontaría el
 * shell entero cada vez que el dueño entra a pagar.
 *
 * Esto es una puerta comercial, no un límite de seguridad: lo que un usuario
 * puede leer o escribir lo gobierna la RLS. Por eso, ante la duda, deja pasar.
 */
export function SuscripcionGuard() {
  const { profile, signOut } = useAuth()
  const estado = useEstadoSuscripcion()
  const location = useLocation()

  // Se espera al estado antes de pintar nada: entrar a la app y que un segundo
  // después te expulse es peor que un spinner corto. La espera está acotada
  // —la query resuelve o falla— y en el camino feliz sale de cache.
  if (estado.isPending) {
    return <Spinner fullscreen label="Verificando tu suscripción" />
  }

  // `estado.data` es null cuando no se pudo leer la fila, y ahí `estaBloqueada`
  // devuelve false: un error de lectura no puede dejar afuera a un cliente al día.
  if (!estaBloqueada(estado.data)) return <Outlet />

  // El dueño necesita llegar a /suscripcion para reactivar: si ya está ahí, se
  // lo deja pasar, y desde cualquier otra ruta se lo manda.
  if (profile?.rol === 'DUENO') {
    if (location.pathname === RUTA_SUSCRIPCION) return <Outlet />
    return <Navigate to={RUTA_SUSCRIPCION} replace />
  }

  // Mientras el profile carga, `rol` es undefined y se cae acá. Es el mismo
  // criterio que usa el sidebar para los links por rol: la ventana dura lo que
  // tarda una query que ya está en vuelo, y el dueño que la atraviese termina
  // redirigido en cuanto llega su perfil.
  return <PantallaCuentaVencida onCerrarSesion={signOut} />
}

/**
 * El final del camino para un agente o asistente: no puede pagar ni seguir
 * usando la app, así que no se le muestra una navegación que no lleva a ningún
 * lado. Sólo el motivo y la salida.
 */
function PantallaCuentaVencida({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-[16px] border border-border bg-surface px-7 py-8 text-center shadow-md">
        <span
          aria-hidden
          className="mx-auto flex size-11 items-center justify-center rounded-full bg-warm-soft text-badge-tibio-ink"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5" />
            <path d="M12 16.2v.3" />
          </svg>
        </span>

        <h1 className="mt-4 mb-0 text-[1.25rem] font-bold text-ink">
          Esta cuenta está vencida
        </h1>

        <p className="mt-2 text-[0.9rem] text-ink-3">
          Contactá al dueño de tu inmobiliaria para reactivarla.
        </p>

        <button
          type="button"
          onClick={onCerrarSesion}
          className="mt-6 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
