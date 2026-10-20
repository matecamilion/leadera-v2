import { useEffect, useRef, type TouchEvent } from 'react'
import { IconoCerrar } from '../leads/Iconos'

/** Cuánto hay que arrastrar el dedo para pasar de foto. */
const UMBRAL_SWIPE = 50

interface Props {
  fotos: string[]
  /** La foto que se ve; tiene que estar dentro de `fotos`. */
  indice: number
  onCerrar: () => void
  onAnterior: () => void
  onSiguiente: () => void
}

/** Visor a pantalla completa: flechas, Escape y, en el celular, swipe horizontal. */
export function VisorFotos({ fotos, indice, onCerrar, onAnterior, onSiguiente }: Props) {
  const inicioX = useRef<number | null>(null)

  // Escape / flechas mientras el visor está abierto.
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'ArrowLeft') onAnterior()
      else if (e.key === 'ArrowRight') onSiguiente()
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [onCerrar, onAnterior, onSiguiente])

  function alEmpezarToque(e: TouchEvent) {
    inicioX.current = e.touches[0]?.clientX ?? null
  }

  function alTerminarToque(e: TouchEvent) {
    const inicio = inicioX.current
    inicioX.current = null
    const fin = e.changedTouches[0]?.clientX
    if (inicio === null || fin === undefined || fotos.length < 2) return
    const distancia = fin - inicio
    if (Math.abs(distancia) < UMBRAL_SWIPE) return
    if (distancia < 0) onSiguiente()
    else onAnterior()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto de la propiedad"
      onClick={onCerrar}
      onTouchStart={alEmpezarToque}
      onTouchEnd={alTerminarToque}
      // pan-y: el scroll vertical sigue siendo del navegador y el horizontal es nuestro.
      className="fixed inset-0 z-50 flex touch-pan-y items-center justify-center bg-ink/85 p-4"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
              onAnterior()
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
              onSiguiente()
            }}
            className="absolute right-4 rounded-full bg-white/10 px-3 py-4 text-2xl leading-none text-white hover:bg-white/20"
          >
            ›
          </button>
        </>
      )}

      <img
        src={fotos[indice]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
      />

      <span className="absolute bottom-6 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
        {indice + 1} / {fotos.length}
      </span>
    </div>
  )
}
