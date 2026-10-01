/**
 * Llamadas a la edge function `consulta-publica`.
 *
 * `fetch` directo y no `supabase.functions.invoke`: hacen falta el status y el
 * `code` exactos de cada respuesta, y la función no pide sesión
 * (`verify_jwt = false`). Ningún desenlace de negocio tira excepción: todo
 * vuelve como un resultado que la página sabe pintar.
 *
 * En desarrollo, `?mock=<caso>` responde con datos falsos (ver mocks.ts) para
 * poder ver cada pantalla sin escribir en la base. Va adentro de
 * `import.meta.env.DEV`, así que el build de producción lo elimina entero.
 */
import type { DatosLink, PayloadConsulta } from './tipos'

const URL_FUNCION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consulta-publica`

export type ResultadoGet =
  | { tipo: 'ok'; datos: DatosLink; recibidoEn: number }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' }

export type ResultadoPost =
  | { tipo: 'ok' }
  | { tipo: 'token_invalido' }
  | { tipo: 'no_disponible' }
  | { tipo: 'invalido'; mensaje: string }
  | { tipo: 'error' }

function mockActivo(): string | null {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(window.location.search).get('mock')
}

export async function obtenerLink(slug: string): Promise<ResultadoGet> {
  if (import.meta.env.DEV) {
    const mock = mockActivo()
    if (mock) return (await import('./mocks')).mockGet(mock)
  }

  try {
    const r = await fetch(`${URL_FUNCION}?slug=${encodeURIComponent(slug)}`)
    if (r.status === 404) return { tipo: 'no_disponible' }
    if (!r.ok) return { tipo: 'error' }
    // `performance.now()` al llegar: desde acá se cuentan los 8 s.
    return { tipo: 'ok', datos: (await r.json()) as DatosLink, recibidoEn: performance.now() }
  } catch {
    return { tipo: 'error' }
  }
}

export async function enviarConsulta(payload: PayloadConsulta): Promise<ResultadoPost> {
  if (import.meta.env.DEV) {
    const mock = mockActivo()
    if (mock) return (await import('./mocks')).mockPost(mock, payload)
  }

  try {
    const r = await fetch(URL_FUNCION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (r.ok) return { tipo: 'ok' }
    if (r.status === 404) return { tipo: 'no_disponible' }

    const cuerpo = (await r.json().catch(() => null)) as { error?: string; code?: string } | null
    if (r.status === 400 && cuerpo?.code === 'TOKEN_INVALIDO') return { tipo: 'token_invalido' }
    if (r.status === 400) {
      return { tipo: 'invalido', mensaje: cuerpo?.error ?? 'Hay un dato que no pudimos procesar.' }
    }
    return { tipo: 'error' }
  } catch {
    return { tipo: 'error' }
  }
}
