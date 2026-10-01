import { useCallback, useRef } from 'react'
import { enviarConsulta, obtenerLink } from './api'
import type { DatosLink, PayloadConsulta } from './tipos'

/**
 * El servidor descarta en silencio lo que llega antes de 8 s desde que emitió
 * el token. Se espera un poco más: el servidor cuenta desde `emitido`, que es
 * anterior a que la respuesta llegue acá, así que el reloj de este lado
 * siempre se queda corto, nunca largo.
 */
const ESPERA_MINIMA_MS = 8_000 + 500

export type DesenlaceEnvio = 'ok' | 'no_disponible' | 'error' | { invalido: string }

function esperar(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
}

interface Token {
  valor: string
  recibidoEn: number
}

/**
 * Envía la consulta respetando la regla de los 8 s.
 *
 * Con TOKEN_INVALIDO pide un token nuevo, vuelve a esperar los 8 s y reenvía
 * solo, una vez, sin que la persona repita nada. `alRenovar` le pasa a la
 * página los datos nuevos del GET.
 */
export function useEnvio(slug: string, alRenovar: (datos: DatosLink, recibidoEn: number) => void) {
  const token = useRef<Token | null>(null)
  const enCurso = useRef(false)

  const fijarToken = useCallback((valor: string, recibidoEn: number) => {
    token.current = { valor, recibidoEn }
  }, [])

  const enviar = useCallback(
    async (armar: (token: string) => PayloadConsulta): Promise<DesenlaceEnvio> => {
      if (enCurso.current || !token.current) return 'error'
      enCurso.current = true
      try {
        for (let intento = 0; intento < 2; intento++) {
          const t = token.current
          await esperar(ESPERA_MINIMA_MS - (performance.now() - t.recibidoEn))

          const r = await enviarConsulta(armar(t.valor))
          if (r.tipo === 'ok') return 'ok'
          if (r.tipo === 'no_disponible') return 'no_disponible'
          if (r.tipo === 'invalido') return { invalido: r.mensaje }
          if (r.tipo === 'error') return 'error'

          // TOKEN_INVALIDO: uno nuevo y otra vuelta, una sola vez.
          if (intento > 0) return 'error'
          const g = await obtenerLink(slug)
          if (g.tipo === 'no_disponible') return 'no_disponible'
          if (g.tipo === 'error') return 'error'
          token.current = { valor: g.datos.token, recibidoEn: g.recibidoEn }
          alRenovar(g.datos, g.recibidoEn)
        }
        return 'error'
      } finally {
        enCurso.current = false
      }
    },
    [slug, alRenovar],
  )

  return { fijarToken, enviar }
}
