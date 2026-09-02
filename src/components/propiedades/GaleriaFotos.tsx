import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useFotosPropiedad } from '../../hooks/useFotosPropiedad'
import { MAX_FOTOS } from '../../lib/api/storage'
import { IconoCerrar, IconoTacho } from '../leads/Iconos'

interface GaleriaFotosProps {
  propiedadId: string
  fotos: string[]
}

/** Cuántas miniaturas se muestran antes del overlay "+N fotos". */
const VISIBLES = 5

export function GaleriaFotos({ propiedadId, fotos }: GaleriaFotosProps) {
  const { subir, eliminar, progreso } = useFotosPropiedad(propiedadId)
  const [indice, setIndice] = useState<number | null>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const cerrar = useCallback(() => setIndice(null), [])
  const anterior = useCallback(
    () => setIndice((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length)),
    [fotos.length],
  )
  const siguiente = useCallback(
    () => setIndice((i) => (i === null ? null : (i + 1) % fotos.length)),
    [fotos.length],
  )

  // Escape / flechas mientras el lightbox está abierto.
  useEffect(() => {
    if (indice === null) return
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') siguiente()
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [indice, cerrar, anterior, siguiente])

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

  const lleno = fotos.length >= MAX_FOTOS
  const error =
    errorLocal ??
    (subir.error instanceof Error ? subir.error.message : null) ??
    (eliminar.error instanceof Error ? eliminar.error.message : null)

  const miniaturas = fotos.length > VISIBLES ? fotos.slice(0, VISIBLES) : fotos

  // Derivado en render y no en un effect: si se borró la última foto con el
  // lightbox abierto, el índice guardado queda fuera de rango y hay que
  // tratarlo como cerrado sin disparar otro render.
  const indiceVisible = indice !== null && indice < fotos.length ? indice : null

  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <span className="text-[0.85rem] font-semibold text-ink-2">Fotos</span>
        <span className="text-[0.8rem] text-ink-3">
          {fotos.length} / {MAX_FOTOS}
        </span>
      </header>

      {fotos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {miniaturas.map((url, i) => (
            <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-2">
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1}`}
                className="block size-full"
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {i === VISIBLES - 1 && fotos.length > VISIBLES && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-bold text-white">
                    +{fotos.length - VISIBLES} fotos
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label="Eliminar foto"
                disabled={eliminar.isPending}
                onClick={() => {
                  // Confirm nativo, igual que el original: para un borrado de
                  // una foto no justifica un modal propio.
                  if (confirm('¿Eliminar esta foto?')) eliminar.mutate(url)
                }}
                className="absolute top-1.5 right-1.5 rounded-md bg-surface/90 p-1.5 text-peligro-ink opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 motion-reduce:transition-none"
              >
                <IconoTacho className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-[0.9rem] text-ink-3">
          Aún no hay fotos cargadas.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
        >
          {error}
        </p>
      )}

      <label
        className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none ${
          subir.isPending || lleno
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
          disabled={subir.isPending || lleno}
          onChange={alElegirArchivos}
        />
      </label>

      <p className="mt-1.5 text-xs text-ink-3">
        Formato imagen, máximo 5 MB por archivo. Hasta {MAX_FOTOS} fotos.
      </p>

      {indiceVisible !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto de la propiedad"
          onClick={cerrar}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <IconoCerrar className="size-6" />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={(e) => {
                  e.stopPropagation()
                  anterior()
                }}
                className="absolute left-4 rounded-full bg-white/10 px-3 py-4 text-2xl leading-none text-white hover:bg-white/20"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={(e) => {
                  e.stopPropagation()
                  siguiente()
                }}
                className="absolute right-4 rounded-full bg-white/10 px-3 py-4 text-2xl leading-none text-white hover:bg-white/20"
              >
                ›
              </button>
            </>
          )}

          <img
            src={fotos[indiceVisible]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />

          <span className="absolute bottom-6 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {indiceVisible + 1} / {fotos.length}
          </span>
        </div>
      )}
    </section>
  )
}
