import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { subirFoto } = vi.hoisted(() => ({ subirFoto: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('./useUid', () => ({ useUid: () => 'u1' }))
vi.mock('../lib/api/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/storage')>()),
  subirFotoPropiedad: subirFoto,
}))

import { ErrorStorage } from '../lib/api/storage'
import { useFotosPropiedad } from './useFotosPropiedad'

const archivo = (nombre: string) => new File(['x'], nombre, { type: 'image/jpeg' })
const archivos = (n: number) => Array.from({ length: n }, (_, i) => archivo(`f${i + 1}.jpg`))

function montar() {
  const queryClient = new QueryClient()
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useFotosPropiedad('p1'), { wrapper })
  return { ...hook, invalidar }
}

describe('useFotosPropiedad.subirLote', () => {
  beforeEach(() => {
    subirFoto.mockReset()
    subirFoto.mockResolvedValue('https://x.test/f.jpg')
  })

  it('sube todas las que caben y avisa de las que no', async () => {
    const { result } = montar()
    // 8 fotos ya cargadas: caben 2 de las 4 elegidas.
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(4), fotosActuales: 8 }))

    expect(subirFoto).toHaveBeenCalledTimes(2)
    expect(subirFoto.mock.calls.map((c) => (c[1] as File).name)).toEqual(['f1.jpg', 'f2.jpg'])
    expect(result.current.subirLote.data).toEqual({
      subidas: 2,
      total: 2,
      descartadas: 2,
      fallos: [],
      cortadoPorPermiso: false,
    })
  })

  it('con el cupo en 0 no sube nada', async () => {
    const { result } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(3), fotosActuales: 10 }))

    expect(subirFoto).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.subirLote.data?.descartadas).toBe(3))
  })

  it('sigue con las demás después de una falla de formato y de una de red', async () => {
    subirFoto
      .mockRejectedValueOnce(new ErrorStorage('No pudimos leer "f1.jpg". Probá con otra foto.'))
      .mockResolvedValueOnce('https://x.test/2.jpg')
      .mockRejectedValueOnce(new ErrorStorage('No se pudo subir la foto: Failed to fetch'))
      .mockResolvedValueOnce('https://x.test/4.jpg')

    const { result } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(4), fotosActuales: 0 }))

    expect(subirFoto).toHaveBeenCalledTimes(4)
    const r = result.current.subirLote.data
    expect(r?.subidas).toBe(2)
    expect(r?.total).toBe(4)
    expect(r?.fallos.map((f) => f.archivo)).toEqual(['f1.jpg', 'f3.jpg'])
    expect(r?.cortadoPorPermiso).toBe(false)
  })

  it('corta en el primer error de permiso y no prueba con el resto', async () => {
    subirFoto
      .mockResolvedValueOnce('https://x.test/1.jpg')
      .mockRejectedValueOnce(new ErrorStorage('No tenés permiso para editar esta propiedad.', false, true))

    const { result } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(5), fotosActuales: 0 }))

    expect(subirFoto).toHaveBeenCalledTimes(2)
    const r = result.current.subirLote.data
    expect(r?.subidas).toBe(1)
    expect(r?.total).toBe(5)
    expect(r?.cortadoPorPermiso).toBe(true)
    expect(r?.fallos).toHaveLength(1)
  })

  it('un error que no es de permiso no corta, aunque diga "permiso" en el texto', async () => {
    subirFoto
      .mockRejectedValueOnce(new ErrorStorage('No se pudo subir la foto: sin permiso de red'))
      .mockResolvedValueOnce('https://x.test/2.jpg')

    const { result } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(2), fotosActuales: 0 }))

    expect(subirFoto).toHaveBeenCalledTimes(2)
    expect(result.current.subirLote.data?.cortadoPorPermiso).toBe(false)
  })

  it('sube en serie: nunca dos a la vez', async () => {
    let enCurso = 0
    let maximo = 0
    subirFoto.mockImplementation(async () => {
      enCurso++
      maximo = Math.max(maximo, enCurso)
      await new Promise((r) => setTimeout(r, 5))
      enCurso--
      return 'https://x.test/f.jpg'
    })

    const { result } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(4), fotosActuales: 0 }))

    expect(subirFoto).toHaveBeenCalledTimes(4)
    expect(maximo).toBe(1)
  })

  it('refresca las listas una sola vez al final, no por foto, y también si hubo fallas', async () => {
    subirFoto.mockRejectedValueOnce(new ErrorStorage('No se pudo subir la foto: x'))
    const { result, invalidar } = montar()
    await act(() => result.current.subirLote.mutateAsync({ archivos: archivos(3), fotosActuales: 0 }))

    // Dos claves (detalle y listado), una vez cada una.
    expect(invalidar).toHaveBeenCalledTimes(2)
  })

  it('informa qué foto se está subiendo y vuelve a null al terminar', async () => {
    let soltar: () => void = () => {}
    subirFoto.mockImplementation(() => new Promise<string>((r) => (soltar = () => r('u'))))

    const { result } = montar()
    act(() => {
      result.current.subirLote.mutate({ archivos: archivos(2), fotosActuales: 0 })
    })
    await waitFor(() => expect(result.current.progresoLote).toEqual({ actual: 1, total: 2 }))

    soltar()
    await waitFor(() => expect(result.current.progresoLote).toEqual({ actual: 2, total: 2 }))
    soltar()
    await waitFor(() => expect(result.current.progresoLote).toBeNull())
  })
})
