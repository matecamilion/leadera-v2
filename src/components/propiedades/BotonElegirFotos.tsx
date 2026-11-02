import { useRef, type ChangeEvent } from 'react'
import { IconoMas } from '../leads/Iconos'

/**
 * Botón que abre el selector de fotos. Sólo elige: qué entra, qué se descarta y
 * cómo se sube lo deciden `planearLote` y `useFotosPropiedad.subirLote`.
 *
 * Sin `capture`: en el celular deja elegir entre la galería y la cámara.
 */
export function BotonElegirFotos({
  etiqueta,
  ariaLabel,
  deshabilitado,
  onElegir,
}: {
  etiqueta: string
  ariaLabel: string
  deshabilitado: boolean
  onElegir: (archivos: File[]) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)

  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (archivos.length > 0) onElegir(archivos)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={deshabilitado}
        aria-label={ariaLabel}
        className="inline-flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] font-semibold text-ink shadow-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      >
        <IconoMas className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{etiqueta}</span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        disabled={deshabilitado}
        onChange={alElegir}
      />
    </>
  )
}
