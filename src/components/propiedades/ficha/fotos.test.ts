import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararFotoFicha, prepararFotosFicha } from './fotos'

/**
 * `fotos.ts` depende de fetch, createImageBitmap y canvas, que jsdom no trae.
 * Se simulan los tres:
 *  - fetch responde según la URL (ok, error HTTP, colgada hasta abortar).
 *  - createImageBitmap devuelve siempre una foto de 4000×3000.
 *  - el canvas no dibuja nada, pero `toBlob` devuelve un Blob cuyo contenido es
 *    el tamaño del canvas en ese momento ("1400x1050"): así cada resultado
 *    cuenta a qué tamaño se redujo.
 */

const BITMAP = { width: 4000, height: 3000 }

type Respuesta = { ok: boolean; status?: number; blob: () => Promise<object> }

/** El tamaño al que se redujo una foto, leído de la URL de datos que devuelve. */
function tamanoDe(urlDeDatos: string): string {
  return atob(urlDeDatos.split(',')[1])
}

function respuestaOk(): Respuesta {
  return { ok: true, blob: async () => ({}) }
}

let fetchMock: ReturnType<typeof vi.fn>
let canvasPedidos: string[]

beforeEach(() => {
  fetchMock = vi.fn(async () => respuestaOk())
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ ...BITMAP, close: vi.fn() })),
  )

  canvasPedidos = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    const tamano = `${this.width}x${this.height}`
    canvasPedidos.push(tamano)
    callback(new Blob([tamano], { type: 'image/jpeg' }))
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://fotos.test/${i + 1}.jpg`)

describe('prepararFotosFicha', () => {
  it('a) si todas bajan bien, devuelve todas, hasta el tope de 9', async () => {
    expect(await prepararFotosFicha(urls(5))).toHaveLength(5)

    fetchMock.mockClear()
    const doce = await prepararFotosFicha(urls(12))
    expect(doce).toHaveLength(9)
    // Las tres últimas ni siquiera se piden.
    expect(fetchMock).toHaveBeenCalledTimes(9)
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(urls(9))
  })

  it('conserva el orden de la propiedad', async () => {
    const resultado = await prepararFotosFicha(urls(4))
    // La principal es la de 1400 y las demás van detrás, en su lugar.
    expect(resultado.map(tamanoDe)).toEqual(['1400x1050', '900x675', '900x675', '900x675'])
  })

  it('b) una URL con error HTTP se descarta sola y las demás siguen', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/3.jpg') ? { ok: false, status: 404, blob: async () => ({}) } : respuestaOk(),
    )
    const resultado = await prepararFotosFicha(urls(5))
    expect(resultado).toHaveLength(4)
  })

  it('b) una URL que lanza (red caída) también se descarta sola', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/2.jpg')) throw new TypeError('Failed to fetch')
      return respuestaOk()
    })
    expect(await prepararFotosFicha(urls(3))).toHaveLength(2)
  })

  it('b) si la foto no se puede decodificar, se descarta sola', async () => {
    const decodificar = vi.fn(async () => ({ ...BITMAP, close: vi.fn() }))
    decodificar.mockRejectedValueOnce(new Error('formato no soportado'))
    vi.stubGlobal('createImageBitmap', decodificar)
    // La primera en decodificarse falla; con tres en paralelo, es la 1.
    expect(await prepararFotosFicha(urls(3))).toHaveLength(2)
  })

  it('d) si fallan todas, devuelve vacío (la ficha usa el caso "sin fotos")', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, blob: async () => ({}) }))
    expect(await prepararFotosFicha(urls(4))).toEqual([])
  })

  it('d) sin URLs, devuelve vacío sin pedir nada', async () => {
    expect(await prepararFotosFicha([])).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a) si falla la primera, la portada (la primera que sobrevive) sale a 1400 px', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/1.jpg') ? { ok: false, status: 404, blob: async () => ({}) } : respuestaOk(),
    )
    const resultado = await prepararFotosFicha(urls(4))
    expect(resultado.map(tamanoDe)).toEqual(['1400x1050', '900x675', '900x675'])
  })

  it('a) la portada solo se vuelve a reducir si la primera falló', async () => {
    const decodificar = vi.mocked(createImageBitmap)

    await prepararFotosFicha(urls(4))
    expect(decodificar).toHaveBeenCalledTimes(4)

    decodificar.mockClear()
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/1.jpg') ? { ok: false, status: 404, blob: async () => ({}) } : respuestaOk(),
    )
    await prepararFotosFicha(urls(4))
    // Tres fotos buenas y una decodificación más para la nueva portada.
    expect(decodificar).toHaveBeenCalledTimes(4)
  })

  it('a) si falla la primera y la segunda, la portada es la tercera, a 1400 px', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/1.jpg') || url.endsWith('/2.jpg')
        ? { ok: false, status: 500, blob: async () => ({}) }
        : respuestaOk(),
    )
    const resultado = await prepararFotosFicha(urls(5))
    expect(resultado.map(tamanoDe)).toEqual(['1400x1050', '900x675', '900x675'])
  })

  it('b) con 12 URLs y 2 rotas entre las primeras 9, completa con las siguientes hasta 9 válidas', async () => {
    const rotas = ['/2.jpg', '/5.jpg']
    fetchMock.mockImplementation(async (url: string) =>
      rotas.some((r) => url.endsWith(r))
        ? { ok: false, status: 404, blob: async () => ({}) }
        : respuestaOk(),
    )
    const resultado = await prepararFotosFicha(urls(12))
    expect(resultado).toHaveLength(9)
    // 9 buenas + 2 rotas = 11 pedidas; la 12 sobra y no se baja.
    expect(fetchMock).toHaveBeenCalledTimes(11)
    expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain('https://fotos.test/12.jpg')
  })

  it('b) si no hay más fotos de repuesto, devuelve las que haya', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/2.jpg') ? { ok: false, status: 404, blob: async () => ({}) } : respuestaOk(),
    )
    expect(await prepararFotosFicha(urls(9))).toHaveLength(8)
  })

  it('c) si fallan todas, devuelve vacío y no intenta más de 15, aunque haya 30', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, blob: async () => ({}) }))
    expect(await prepararFotosFicha(urls(30))).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(15)
  })

  it('e) baja de a 3 a la vez', async () => {
    const pendientes: Array<() => void> = []
    let activas = 0
    let maximo = 0
    fetchMock.mockImplementation(
      () =>
        new Promise<Respuesta>((resolver) => {
          activas++
          maximo = Math.max(maximo, activas)
          pendientes.push(() => {
            activas--
            resolver(respuestaOk())
          })
        }),
    )

    const promesa = prepararFotosFicha(urls(9))
    // Arrancan exactamente tres descargas, no nueve.
    await vi.waitFor(() => expect(pendientes).toHaveLength(3))
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Cada una que termina deja entrar a la siguiente.
    let resueltas = 0
    while (resueltas < 9) {
      await vi.waitFor(() => expect(pendientes.length).toBeGreaterThan(resueltas))
      pendientes[resueltas]()
      resueltas++
    }

    expect(await promesa).toHaveLength(9)
    expect(fetchMock).toHaveBeenCalledTimes(9)
    expect(maximo).toBe(3)
  })

  it('e) la principal se reduce a 1400 px de lado largo y el resto a 900', async () => {
    await prepararFotosFicha(urls(4))
    // Con una foto de 4000×3000: 1400 → 1400×1050 y 900 → 900×675 (mismo aspecto).
    expect(canvasPedidos.filter((t) => t === '1400x1050')).toHaveLength(1)
    expect(canvasPedidos.filter((t) => t === '900x675')).toHaveLength(3)
  })

  it('e) una foto más chica que el límite no se agranda', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    )
    const [foto] = await prepararFotosFicha(urls(1))
    expect(tamanoDe(foto)).toBe('800x600')
  })

  it('a) devuelve URLs de datos JPEG', async () => {
    const [foto] = await prepararFotosFicha(urls(1))
    expect(foto.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})

describe('prepararFotoFicha: timeout', () => {
  /** Un fetch que no responde nunca y rechaza al abortarse, como el real. */
  function fetchColgado() {
    let senal: AbortSignal | undefined
    fetchMock.mockImplementation(
      (_url: string, opciones?: { signal?: AbortSignal }) =>
        new Promise((_resolver, rechazar) => {
          senal = opciones?.signal
          senal?.addEventListener('abort', () =>
            rechazar(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    return () => senal
  }

  it('c) corta a los 12 segundos exactos y devuelve null', async () => {
    vi.useFakeTimers()
    const senal = fetchColgado()

    const promesa = prepararFotoFicha(urls(1)[0], 1400)

    await vi.advanceTimersByTimeAsync(11_999)
    expect(senal()?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(senal()?.aborted).toBe(true)
    expect(await promesa).toBeNull()
  })

  it('c) una foto colgada se descarta sola y las demás siguen', async () => {
    vi.useFakeTimers()
    const colgada = urls(3)[1]
    fetchMock.mockImplementation(
      (url: string, opciones?: { signal?: AbortSignal }) =>
        url === colgada
          ? new Promise((_resolver, rechazar) =>
              opciones?.signal?.addEventListener('abort', () =>
                rechazar(new DOMException('Aborted', 'AbortError')),
              ),
            )
          : Promise.resolve(respuestaOk()),
    )

    const promesa = prepararFotosFicha(urls(3))
    await vi.advanceTimersByTimeAsync(12_000)
    expect(await promesa).toHaveLength(2)
  })

  it('c) una respuesta que llega a tiempo no se aborta', async () => {
    // Reloj real: el FileReader de jsdom usa timers y no avanza con los falsos.
    let senal: AbortSignal | undefined
    fetchMock.mockImplementation(async (_url: string, opciones?: { signal?: AbortSignal }) => {
      senal = opciones?.signal
      return respuestaOk()
    })

    expect(await prepararFotoFicha(urls(1)[0], 900)).not.toBeNull()
    expect(senal?.aborted).toBe(false)
  })
})
