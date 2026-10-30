import { useEffect, useState } from 'react'

/** `valor` recién cuando pasaron `ms` sin que cambie: para no redibujar en cada tecla. */
export function useDiferido<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor)

  useEffect(() => {
    const temporizador = window.setTimeout(() => setDiferido(valor), ms)
    return () => window.clearTimeout(temporizador)
  }, [valor, ms])

  return diferido
}
