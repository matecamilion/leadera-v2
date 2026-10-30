import { IconoCerrar } from '../leads/Iconos'
import { EditorFlyer, type DatosPropiedad } from './EditorFlyer'

/** El editor de flyers dentro de la ficha de la propiedad, con su título y el botón de cerrar. */
export default function PanelCrearImagen({
  propiedad,
  onCerrar,
}: {
  propiedad: DatosPropiedad
  onCerrar: () => void
}) {
  return (
    <section
      aria-label="Crear flyer para publicar"
      className="mb-6 rounded-2xl bg-brand-softer px-4 py-4 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">Crear flyer</h2>
          <p className="m-0 mt-0.5 text-[0.8rem] text-ink-3">
            Un flyer listo para Instagram (1080×1350). No se guarda: lo descargás y listo.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el panel del flyer"
          className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>

      <EditorFlyer propiedad={propiedad} />
    </section>
  )
}
