import { useEffect, useState, type ChangeEvent } from 'react'
import { MAX_FOTOS, validarArchivo } from '../../lib/api/storage'
import { IconoCerrar } from '../leads/Iconos'

interface Props {
  archivos: File[]
  onChange: (archivos: File[]) => void
  /** Mientras se crea y se suben las fotos, todo queda bloqueado. */
  disabled: boolean
  progreso: { actual: number; total: number } | null
}

/** Fotos opcionales del alta: se eligen acá y se suben después de crear la propiedad. */
export function SeccionFotosAlta({ archivos, onChange, disabled, progreso }: Props) {
  const [urls, setUrls] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  // Las URLs locales retienen el archivo en memoria hasta que se liberan.
  useEffect(() => {
    const nuevas = archivos.map((a) => URL.createObjectURL(a))
    setUrls(nuevas)
    return () => nuevas.forEach((u) => URL.revokeObjectURL(u))
  }, [archivos])

  const lleno = archivos.length >= MAX_FOTOS

  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (elegidos.length === 0) return

    const validos = elegidos.filter((f) => validarArchivo(f) === null)
    const invalidas = elegidos.length - validos.length
    const lugar = MAX_FOTOS - archivos.length
    const aceptados = validos.slice(0, lugar)
    const sobran = validos.length - aceptados.length

    const avisos: string[] = []
    if (invalidas > 0) {
      avisos.push(
        invalidas === 1
          ? 'Una foto no es una imagen o pesa más de 25 MB: la descartamos.'
          : `${invalidas} fotos no son imágenes o pesan más de 25 MB: las descartamos.`,
      )
    }
    if (sobran > 0) {
      avisos.push(
        `Podés cargar hasta ${MAX_FOTOS} fotos. ${sobran === 1 ? 'Descartamos 1' : `Descartamos ${sobran}`} de las que elegiste.`,
      )
    }
    setAviso(avisos.length > 0 ? avisos.join(' ') : null)

    if (aceptados.length > 0) onChange([...archivos, ...aceptados])
  }

  function quitar(indice: number) {
    setAviso(null)
    onChange(archivos.filter((_, i) => i !== indice))
  }

  return (
    <section aria-label="Fotos" className="mt-5">
      <h2 className="m-0 text-[0.95rem] font-bold text-ink">
        Fotos{' '}
        <span className="text-[0.8rem] font-normal text-ink-3 tabular-nums">
          {archivos.length}/{MAX_FOTOS}
        </span>
      </h2>
      <p className="m-0 mt-0.5 text-[0.8rem] text-ink-3">
        Con fotos, la ficha y el flyer se ven mucho mejor. Es opcional: la primera es la portada.
      </p>

      {archivos.length > 0 && (
        <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {archivos.map((archivo, i) => (
            <li key={`${archivo.name}-${archivo.lastModified}-${i}`} className="flex flex-col gap-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-2">
                {urls[i] && <img src={urls[i]} alt="" className="size-full object-cover" />}
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-contrast">
                    Portada
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => quitar(i)}
                aria-label={`Quitar la foto ${i + 1}`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.78rem] font-semibold text-peligro-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 motion-reduce:transition-none"
              >
                <IconoCerrar className="size-4" />
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso && (
        <p role="alert" className="mt-3 mb-0 text-[0.85rem] text-peligro-ink">
          {aviso}
        </p>
      )}

      <label
        className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none ${
          disabled || lleno
            ? 'cursor-not-allowed text-ink-4 opacity-60'
            : 'cursor-pointer text-ink hover:bg-background'
        }`}
      >
        + Agregar fotos
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={disabled || lleno}
          onChange={alElegir}
        />
      </label>

      <p className="m-0 mt-1.5 text-xs text-ink-3">
        Las fotos se reducen solas al subirlas (hasta 25 MB cada una). Hasta {MAX_FOTOS} fotos.
      </p>

      {progreso && (
        <div role="status" className="mt-3">
          <p className="m-0 mb-1.5 text-[0.85rem] font-semibold text-ink">
            Subiendo foto {Math.min(progreso.actual + 1, progreso.total)} de {progreso.total}…
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${(progreso.actual / progreso.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
