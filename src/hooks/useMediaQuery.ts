import { useCallback, useSyncExternalStore } from 'react'

/**
 * Si una media query se cumple ahora, y se actualiza cuando cambia. Sin
 * `matchMedia` (jsdom, render en servidor) no se cumple nunca.
 */
export function useMediaQuery(query: string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const lista = window.matchMedia(query)
      lista.addEventListener('change', avisar)
      return () => lista.removeEventListener('change', avisar)
    },
    [query],
  )
  const leer = useCallback(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
    [query],
  )
  return useSyncExternalStore(suscribir, leer, () => false)
}
