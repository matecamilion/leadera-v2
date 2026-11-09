import { useEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { CambioDeEstado, EstadoOperacion } from '../../lib/api/operaciones'
import type { DatosDeCierre } from './ModalConfirmarCierre'
import { GrupoEstadoOperacion } from './GrupoEstadoOperacion'

// jsdom no implementa showModal ni close: se emulan con el atributo `open`.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const VENTA: DatosDeCierre = { tipo: 'VENTA', moneda: 'USD', monto: 150000, monto_cierre: null }

let cambiarDesdeAfuera: (estado: EstadoOperacion) => void = () => {}

/**
 * Hace de la ficha: `actual` cambia cuando `onCambiar` llega (como cuando la
 * mutación entra) o desde afuera (refetch, otra pestaña) sin pasar por el grupo.
 */
function Ficha({
  inicial,
  alCambiar,
}: {
  inicial: EstadoOperacion
  alCambiar: (cambio: CambioDeEstado) => void
}) {
  const [actual, setActual] = useState(inicial)
  useEffect(() => {
    cambiarDesdeAfuera = setActual
  }, [])
  return (
    <GrupoEstadoOperacion
      operacion={VENTA}
      actual={actual}
      guardando={false}
      onCambiar={(cambio) => {
        alCambiar(cambio)
        setActual(cambio.estado)
      }}
    />
  )
}

function montar(inicial: EstadoOperacion = 'PUBLICADA') {
  const alCambiar = vi.fn()
  render(<Ficha inicial={inicial} alCambiar={alCambiar} />)
  return alCambiar
}

const chip = (nombre: RegExp) => screen.getByRole('button', { name: nombre })
const hayModalDeCierre = () => screen.queryByText('Sí, cerrar como ganada') !== null
const hayModalDeCancelar = () => screen.queryByText('Sí, cancelar la operación') !== null

/** Deja la operación cerrada como ganada pasando por el diálogo, como en la ficha. */
function cerrarEnLaSesion() {
  fireEvent.click(chip(/cerrada|vendida/i))
  fireEvent.click(screen.getByText('Sí, cerrar como ganada'))
}

function cancelarEnLaSesion() {
  fireEvent.click(chip(/cancelada/i))
  fireEvent.click(screen.getByText('Sí, cancelar la operación'))
}

describe('GrupoEstadoOperacion — destinos', () => {
  it('abierto → cerrada ganada pide el valor y entrega el cierre', () => {
    const alCambiar = montar()
    fireEvent.click(chip(/cerrada|vendida/i))
    expect(hayModalDeCierre()).toBe(true)
    fireEvent.click(screen.getByText('Sí, cerrar como ganada'))
    expect(alCambiar).toHaveBeenCalledWith({ estado: 'CERRADA_GANADA', montoCierre: 150000 })
  })

  it('cancelada → cerrada ganada sigue pidiendo el valor', () => {
    const alCambiar = montar('CANCELADA')
    fireEvent.click(chip(/cerrada|vendida/i))
    expect(hayModalDeCierre()).toBe(true)
    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('abierto → cancelada es una confirmación simple, sin campo de valor', () => {
    montar()
    fireEvent.click(chip(/cancelada/i))
    expect(hayModalDeCancelar()).toBe(true)
    expect(screen.queryByLabelText('Valor de cierre')).toBeNull()
  })
})

describe('GrupoEstadoOperacion — reabrir una operación cerrada en la sesión', () => {
  it.each([
    ['PUBLICADA', /publicada|disponible/i],
    ['RESERVADA', /reservada/i],
    ['EN_NEGOCIACION', /negociaci/i],
  ] as const)('cerrada ganada → %s cambia directo y no reabre el diálogo', (destino, nombre) => {
    const alCambiar = montar()
    cerrarEnLaSesion()
    alCambiar.mockClear()

    fireEvent.click(chip(nombre))

    expect(alCambiar).toHaveBeenCalledWith({ estado: destino })
    expect(hayModalDeCierre()).toBe(false)
    expect(hayModalDeCancelar()).toBe(false)
  })

  it('cerrada ganada → cancelada pide la confirmación simple', () => {
    montar()
    cerrarEnLaSesion()
    fireEvent.click(chip(/cancelada/i))
    expect(hayModalDeCancelar()).toBe(true)
    expect(hayModalDeCierre()).toBe(false)
  })

  it('cancelada en la sesión → estado abierto no reabre la confirmación', () => {
    const alCambiar = montar()
    cancelarEnLaSesion()
    alCambiar.mockClear()

    fireEvent.click(chip(/reservada/i))

    expect(alCambiar).toHaveBeenCalledWith({ estado: 'RESERVADA' })
    expect(hayModalDeCancelar()).toBe(false)
  })

  it('un cambio de `actual` desde afuera no reabre el diálogo ya resuelto', () => {
    montar()
    cerrarEnLaSesion()

    act(() => cambiarDesdeAfuera('RESERVADA'))
    expect(hayModalDeCierre()).toBe(false)

    act(() => cambiarDesdeAfuera('EN_NEGOCIACION'))
    expect(hayModalDeCierre()).toBe(false)
  })

  it('lo mismo con una cancelación resuelta', () => {
    montar()
    cancelarEnLaSesion()
    act(() => cambiarDesdeAfuera('PUBLICADA'))
    expect(hayModalDeCancelar()).toBe(false)
  })

  it('cancelar el diálogo no deja un pedido que reaparezca al cambiar `actual`', () => {
    montar()
    fireEvent.click(chip(/cerrada|vendida/i))
    fireEvent.click(screen.getByText('No, volver'))
    expect(hayModalDeCierre()).toBe(false)

    act(() => cambiarDesdeAfuera('RESERVADA'))
    expect(hayModalDeCierre()).toBe(false)
  })
})
