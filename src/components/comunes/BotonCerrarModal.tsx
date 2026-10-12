import { IconoCerrar } from '../leads/Iconos'

/**
 * Cruz de cierre de los modales largos.
 *
 * Va como primer hijo del contenedor que scrollea. El wrapper de alto 0 y
 * `sticky` la mantiene arriba a la derecha sin ocupar lugar en el layout.
 */
export function BotonCerrarModal({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="sticky top-3 z-10 -mt-4 -mr-4 flex h-0 justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--shadow-focus)] motion-reduce:transition-none"
      >
        <IconoCerrar className="size-[18px]" />
      </button>
    </div>
  )
}
