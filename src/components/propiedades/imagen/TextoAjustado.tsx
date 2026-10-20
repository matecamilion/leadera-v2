import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'

interface Props {
  texto: string
  tamanoMax: number
  tamanoMin: number
  /** Alto de la zona: el texto baja de tamaño hasta entrar en este alto. */
  altoMax: number
  interlineado?: number
  style?: CSSProperties
}

/**
 * Texto centrado que se achica hasta entrar en su zona, en una o varias
 * líneas, sin cortarse. Mide con offsetHeight y scrollWidth, que no cambian
 * con el transform de la vista previa.
 */
export function TextoAjustado({
  texto,
  tamanoMax,
  tamanoMin,
  altoMax,
  interlineado = 1.05,
  style,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const ajustar = useCallback(() => {
    const el = ref.current
    if (!el) return
    for (let t = tamanoMax; t >= tamanoMin; t -= 2) {
      el.style.fontSize = `${t}px`
      if (el.offsetHeight <= altoMax && el.scrollWidth <= el.clientWidth) return
    }
  }, [tamanoMax, tamanoMin, altoMax])

  useLayoutEffect(ajustar, [ajustar, texto])

  // Las medidas dependen de la tipografía: se repiten cuando termina de cargar.
  useEffect(() => {
    document.fonts.addEventListener('loadingdone', ajustar)
    void document.fonts.ready.then(ajustar)
    return () => document.fonts.removeEventListener('loadingdone', ajustar)
  }, [ajustar])

  return (
    <div style={{ height: altoMax, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div
        ref={ref}
        style={{ width: '100%', minWidth: 0, textAlign: 'center', lineHeight: interlineado, ...style }}
      >
        {texto}
      </div>
    </div>
  )
}
