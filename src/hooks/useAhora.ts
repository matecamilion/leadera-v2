import { useEffect, useState } from 'react'

const UN_MINUTO = 60_000

/**
 * La hora local del navegador, actualizada cada minuto y al volver a la pestaña
 * (los intervalos de una pestaña en segundo plano se frenan). Con la hora sola alcanza
 * para saber también cuándo cambia el día.
 */
export function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const actualizar = () => setAhora(new Date())
    const id = window.setInterval(actualizar, UN_MINUTO)
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  return ahora
}
