import { act, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LienzoMiniatura } from './LienzoMiniatura'
import type { DatosImagen } from './tipos'
import { useDiferido } from './useDiferido'

const D: DatosImagen = {
  fotos: [],
  titulo: 'Chauvín',
  subtitulo: 'Casa',
  datos: [],
  nota: '',
  encabezado: '',
  etiqueta: 'EN VENTA',
  direccion: '',
  precio: 'USD 100.000',
  agente: '',
  firma: '',
  paleta: {
    clave: 'negro',
    nombre: 'Blanco y negro',
    fondo: '#ffffff',
    tinta: '#111111',
    acento: '#111111',
    acentoTexto: '#111111',
    sobreAcento: '#ffffff',
  },
}

describe('LienzoMiniatura', () => {
  it('no vuelve a dibujar la plantilla si `d` es el mismo objeto', () => {
    const dibujos = vi.fn()
    const Plantilla = ({ d }: { d: DatosImagen }) => {
      dibujos()
      return <div>{d.titulo}</div>
    }

    const { rerender } = render(<LienzoMiniatura Componente={Plantilla} d={D} />)
    expect(dibujos).toHaveBeenCalledTimes(1)

    rerender(<LienzoMiniatura Componente={Plantilla} d={D} />)
    expect(dibujos).toHaveBeenCalledTimes(1)

    rerender(<LienzoMiniatura Componente={Plantilla} d={{ ...D, titulo: 'Otro' }} />)
    expect(dibujos).toHaveBeenCalledTimes(2)
  })

  it('queda fuera del foco y del lector de pantalla', () => {
    const { container } = render(<LienzoMiniatura Componente={() => <button>x</button>} d={D} />)
    const raiz = container.firstElementChild as HTMLElement
    expect(raiz.getAttribute('aria-hidden')).toBe('true')
    expect(raiz.hasAttribute('inert')).toBe(true)
  })
})

describe('useDiferido', () => {
  afterEach(() => vi.useRealTimers())

  it('entrega el valor nuevo recién después de la pausa', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDiferido(v, 300), {
      initialProps: { v: 'a' },
    })
    expect(result.current).toBe('a')

    rerender({ v: 'ab' })
    rerender({ v: 'abc' })
    act(() => void vi.advanceTimersByTime(299))
    expect(result.current).toBe('a')

    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe('abc')
  })
})
