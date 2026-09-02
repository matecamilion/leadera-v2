import { useEffect } from 'react'
import { useUiStore } from '../stores/ui'
import { IconoCerrar } from './leads/Iconos'

/** Cuánto queda en pantalla antes de irse solo. */
const DURACION_MS = 4000

/**
 * Aviso flotante de una sola acción, dibujado desde el AppLayout.
 *
 * La app no tenía forma de confirmar algo que termina en una navegación —el
 * componente que hizo la acción ya no está montado cuando habría que mostrar el
 * mensaje—. El texto se deja en el store de UI (`mostrarAviso`) y esto lo pinta
 * sobre la página de destino, sin que esa página tenga que participar.
 *
 * `role="status"` y no `role="alert"`: confirma algo que el usuario acaba de
 * hacer, no interrumpe. Los lectores de pantalla lo anuncian al terminar la
 * frase en curso.
 */
export function AvisoFlash() {
  const aviso = useUiStore((s) => s.aviso)
  const limpiarAviso = useUiStore((s) => s.limpiarAviso)

  // Depende del `id` y no del objeto: así un aviso nuevo con el mismo texto
  // vuelve a arrancar el reloj en vez de heredar lo que quedaba del anterior.
  const id = aviso?.id
  useEffect(() => {
    if (id == null) return
    const timer = setTimeout(limpiarAviso, DURACION_MS)
    return () => clearTimeout(timer)
  }, [id, limpiarAviso])

  if (!aviso) return null

  const esError = aviso.tono === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed inset-x-4 bottom-4 z-50 flex items-start gap-3 rounded-lg border px-4 py-3',
        'text-[0.9rem] shadow-modal sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-[380px]',
        esError
          ? 'border-peligro-borde bg-peligro-soft text-peligro-ink'
          : 'border-border bg-surface text-ink',
      ].join(' ')}
    >
      {!esError && (
        <span
          aria-hidden
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}

      <span className="flex-1">{aviso.mensaje}</span>

      <button
        type="button"
        onClick={limpiarAviso}
        aria-label="Cerrar el aviso"
        className="-mr-1 shrink-0 rounded p-0.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink motion-reduce:transition-none"
      >
        <IconoCerrar className="size-4" />
      </button>
    </div>
  )
}
