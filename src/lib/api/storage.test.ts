import { beforeEach, describe, expect, it, vi } from 'vitest'

const { estado } = vi.hoisted(() => ({
  estado: {
    subida: async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
    escritura: async (): Promise<{ data: { id: string } | null; error: null }> => ({
      data: { id: 'p1' },
      error: null,
    }),
  },
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { fotos_urls: [] }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({ select: () => ({ maybeSingle: () => estado.escritura() }) }),
      }),
    }),
    storage: {
      from: () => ({
        upload: () => estado.subida(),
        getPublicUrl: () => ({ data: { publicUrl: 'https://x.test/p1/a.jpg' } }),
      }),
    },
  },
}))
// Sin canvas en jsdom: la compresión no es lo que se prueba acá.
vi.mock('../prepararFoto', () => ({
  MAX_BYTES_ENTRADA: 25 * 1024 * 1024,
  prepararFoto: async (f: File) => f,
}))

import { ErrorStorage, subirFotoPropiedad } from './storage'

const foto = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' })

async function falla(): Promise<ErrorStorage> {
  try {
    await subirFotoPropiedad('p1', foto())
  } catch (e) {
    return e as ErrorStorage
  }
  throw new Error('tenía que fallar')
}

describe('ErrorStorage.esPermiso', () => {
  beforeEach(() => {
    estado.subida = async () => ({ error: null })
    estado.escritura = async () => ({ data: { id: 'p1' }, error: null })
  })

  it('el rechazo por RLS del bucket lo activa, con el mismo mensaje de siempre', async () => {
    estado.subida = async () => ({
      error: { message: 'new row violates row-level security policy' },
    })
    const e = await falla()
    expect(e.esPermiso).toBe(true)
    expect(e.esFaltaBucket).toBe(true)
    expect(e.message).toBe(
      'El bucket "propiedades-fotos" existe pero no tenés permiso para subir. Faltan las políticas de Storage.',
    )
  })

  it('el "No tenés permiso para editar esta propiedad" del update lo activa', async () => {
    estado.escritura = async () => ({ data: null, error: null })
    const e = await falla()
    expect(e.esPermiso).toBe(true)
    expect(e.esFaltaBucket).toBe(false)
    expect(e.message).toBe('No tenés permiso para editar esta propiedad.')
  })

  it('un error de red o de bucket inexistente no lo activa', async () => {
    estado.subida = async () => ({ error: { message: 'Failed to fetch' } })
    const red = await falla()
    expect(red.esPermiso).toBe(false)
    expect(red.message).toBe('No se pudo subir la foto: Failed to fetch')

    estado.subida = async () => ({ error: { message: 'Bucket not found' } })
    const bucket = await falla()
    expect(bucket.esPermiso).toBe(false)
    expect(bucket.esFaltaBucket).toBe(true)
  })

  it('un archivo que no es imagen no lo activa', async () => {
    try {
      await subirFotoPropiedad('p1', new File(['x'], 'a.pdf', { type: 'application/pdf' }))
      throw new Error('tenía que fallar')
    } catch (e) {
      expect((e as ErrorStorage).esPermiso).toBe(false)
    }
  })

  it('la subida que anda no falla', async () => {
    await expect(subirFotoPropiedad('p1', foto())).resolves.toBe('https://x.test/p1/a.jpg')
  })
})
