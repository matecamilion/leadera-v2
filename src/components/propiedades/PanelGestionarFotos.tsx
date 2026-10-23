import { useState, type ChangeEvent } from 'react'
import { useFotosPropiedad } from '../../hooks/useFotosPropiedad'
import { MAX_FOTOS } from '../../lib/api/storage'
import { ModalConfirmarEliminar } from '../comunes/ModalConfirmarEliminar'
import { IconoCerrar, IconoTacho } from '../leads/Iconos'

interface Props {
  propiedadId: string
  fotos: string[]
  onCerrar: () => void
  /** Abre el panel del flyer. */
  onCrearFlyer: () => void
}

/** Con menos fotos que esto ninguna plantilla del flyer se puede usar. */
const FOTOS_PARA_FLYER = 3

const CLASE_ACCION =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.78rem] font-semibold transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 motion-reduce:transition-none'

/**
 * Agregar, elegir portada y eliminar. La portada es la primera del array.
 *
 * Una sola mutación a la vez: las tres leen y escriben `fotos_urls`, y dos en
 * paralelo se pisarían. Mientras una está en curso, todo queda deshabilitado.
 */
export function PanelGestionarFotos({ propiedadId, fotos, onCerrar, onCrearFlyer }: Props) {
  const { subir, eliminar, portada, progreso } = useFotosPropiedad(propiedadId)
  const [fotoAEliminar, setFotoAEliminar] = useState<string | null>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const ocupado = subir.isPending || eliminar.isPending || portada.isPending
  const lleno = fotos.length >= MAX_FOTOS

  function alElegirArchivos(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return

    setErrorLocal(null)
    const restantes = MAX_FOTOS - fotos.length
    if (archivos.length > restantes) {
      setErrorLocal(
        `Límite de ${MAX_FOTOS} fotos. Podés agregar ${restantes === 1 ? '1 más' : `${restantes} más`}.`,
      )
      return
    }
    subir.mutate(archivos)
  }

  const error =
    errorLocal ??
    (subir.error instanceof Error ? subir.error.message : null) ??
    (portada.error instanceof Error ? portada.error.message : null)

  return (
    <section aria-label="Gestionar fotos" className="rounded-2xl bg-brand-softer px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">
            Gestionar fotos{' '}
            <span className="text-[0.8rem] font-normal text-ink-3 tabular-nums">
              {fotos.length}/{MAX_FOTOS}
            </span>
          </h2>
          <p className="m-0 mt-0.5 text-[0.8rem] text-ink-3">
            La portada es la primera foto: la usan el listado y el flyer para publicar.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          disabled={ocupado}
          aria-label="Cerrar la gestión de fotos"
          className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-50 sm:size-9"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>

      {fotos.length >= FOTOS_PARA_FLYER && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="m-0 text-[0.82rem] text-ink-2">
            Con estas fotos podés crear un flyer para publicar
          </p>
          <button
            type="button"
            onClick={onCrearFlyer}
            className="inline-flex min-h-11 items-center rounded-lg border border-primary bg-surface px-3.5 text-[0.82rem] font-semibold text-primary transition-colors hover:bg-brand-softer sm:min-h-9 motion-reduce:transition-none"
          >
            Crear flyer
          </button>
        </div>
      )}

      {fotos.length > 0 && (
        <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {fotos.map((url, i) => (
            <li key={url} className="flex flex-col gap-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-2">
                <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-contrast">
                    Portada
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {i > 0 && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => portada.mutate(url)}
                    aria-label={`Hacer portada la foto ${i + 1}`}
                    className={`${CLASE_ACCION} text-ink`}
                  >
                    Hacer portada
                  </button>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setFotoAEliminar(url)}
                  aria-label={`Eliminar la foto ${i + 1}`}
                  className={`${CLASE_ACCION} text-peligro-ink`}
                >
                  <IconoTacho className="size-4" />
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 mb-0 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
        >
          {error}
        </p>
      )}

      <label
        className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none ${
          ocupado || lleno
            ? 'cursor-not-allowed text-ink-4 opacity-60'
            : 'cursor-pointer text-ink hover:bg-background'
        }`}
      >
        {progreso ? `Subiendo ${progreso.actual} de ${progreso.total}…` : '+ Agregar fotos'}
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={ocupado || lleno}
          onChange={alElegirArchivos}
        />
      </label>

      <p className="m-0 mt-1.5 text-xs text-ink-3">
        Las fotos se reducen solas al subirlas (hasta 25 MB cada una). Hasta {MAX_FOTOS} fotos.
      </p>

      <ModalConfirmarEliminar
        abierto={fotoAEliminar !== null}
        titulo="¿Eliminar esta foto?"
        descripcion="La foto sale de la ficha. Si era la portada, la siguiente ocupa su lugar."
        eliminando={eliminar.isPending}
        error={eliminar.error instanceof Error ? eliminar.error.message : null}
        onCancelar={() => {
          eliminar.reset()
          setFotoAEliminar(null)
        }}
        onConfirmar={() => {
          if (fotoAEliminar === null) return
          eliminar.mutate(fotoAEliminar, { onSuccess: () => setFotoAEliminar(null) })
        }}
      />
    </section>
  )
}
