import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ModalConfirmarCierre, type DatosDeCierre } from './ModalConfirmarCierre'

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

function abrir(
  operacion: DatosDeCierre = VENTA,
  extra: { estado?: 'CERRADA_GANADA' | 'CANCELADA'; procesando?: boolean; error?: string } = {},
) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <ModalConfirmarCierre
      estado={extra.estado ?? 'CERRADA_GANADA'}
      operacion={operacion}
      procesando={extra.procesando ?? false}
      error={extra.error}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
    />,
  )
  return { onConfirmar, onCancelar }
}

const campo = (etiqueta = 'Valor de cierre') => screen.getByLabelText(etiqueta) as HTMLInputElement
const confirmar = () => fireEvent.click(screen.getByText('Sí, cerrar como ganada'))
const escribir = (valor: string, etiqueta?: string) =>
  fireEvent.change(campo(etiqueta), { target: { value: valor } })

describe('ModalConfirmarCierre — cerrar como ganada', () => {
  it('arranca con el monto publicado, muestra la moneda y lo publicado como ayuda', () => {
    abrir()
    expect(campo().value).toBe('150000')
    expect(screen.getByLabelText('Moneda').textContent).toBe('USD')
    expect(screen.getByText(/Publicado: USD 150\.000/)).toBeTruthy()
  })

  it('confirmar sin tocar nada entrega el publicado (si cerró igual, es confirmar)', () => {
    const { onConfirmar } = abrir()
    confirmar()
    expect(onConfirmar).toHaveBeenCalledWith(150000)
  })

  it('una reapertura arranca con el valor de cierre anterior, no con el publicado', () => {
    abrir({ ...VENTA, monto_cierre: 140000 })
    expect(campo().value).toBe('140000')
  })

  it('sin monto publicado el campo arranca vacío y no hay texto de ayuda', () => {
    abrir({ ...VENTA, monto: null })
    expect(campo().value).toBe('')
    expect(screen.queryByText(/Publicado:/)).toBeNull()
  })

  it('entrega el valor cargado', () => {
    const { onConfirmar } = abrir()
    escribir('140000')
    confirmar()
    expect(onConfirmar).toHaveBeenCalledWith(140000)
  })

  it('vacío no confirma y avisa recién tras el primer intento', () => {
    const { onConfirmar } = abrir({ ...VENTA, monto: null })
    expect(screen.queryByText('Cargá el valor de cierre.')).toBeNull()
    confirmar()
    expect(screen.getByText('Cargá el valor de cierre.')).toBeTruthy()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it.each(['0', '-5'])('%s no confirma', (valor) => {
    const { onConfirmar } = abrir()
    escribir(valor)
    confirmar()
    expect(screen.getByText('El valor tiene que ser 1 o más.')).toBeTruthy()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('pasarse del tope avisa enseguida y no confirma', () => {
    const { onConfirmar } = abrir()
    escribir('10000001')
    expect(screen.getByText('Ese valor parece demasiado alto, revisalo.')).toBeTruthy()
    confirmar()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('el tope exacto se acepta', () => {
    const { onConfirmar } = abrir()
    escribir('10000000')
    confirmar()
    expect(onConfirmar).toHaveBeenCalledWith(10000000)
  })

  it.each(['ALQUILER', 'BUSQUEDA_ALQUILER'] as const)('%s pide el canon mensual acordado', (tipo) => {
    abrir({ ...VENTA, tipo })
    expect(campo('Canon mensual acordado')).toBeTruthy()
  })

  it.each(['VENTA', 'COMPRA'] as const)('%s pide el valor de cierre', (tipo) => {
    abrir({ ...VENTA, tipo })
    expect(campo('Valor de cierre')).toBeTruthy()
  })

  it('la moneda de la operación es la que se muestra', () => {
    abrir({ ...VENTA, moneda: 'ARS' })
    expect(screen.getByLabelText('Moneda').textContent).toBe('ARS')
  })

  it('procesando bloquea el campo y los botones, y cambia el texto', () => {
    abrir(VENTA, { procesando: true })
    expect(campo().disabled).toBe(true)
    expect((screen.getByText('Cerrando…') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('No, volver') as HTMLButtonElement).disabled).toBe(true)
  })

  it('muestra el error del servidor dentro del diálogo', () => {
    abrir(VENTA, { error: 'No se pudo cerrar la operación: no existe, ya está cerrada o no tenés permiso.' })
    expect(screen.getByText(/ya está cerrada o no tenés permiso/)).toBeTruthy()
  })

  it('"No, volver" cancela', () => {
    const { onCancelar, onConfirmar } = abrir()
    fireEvent.click(screen.getByText('No, volver'))
    expect(onCancelar).toHaveBeenCalled()
    expect(onConfirmar).not.toHaveBeenCalled()
  })
})

describe('ModalConfirmarCierre — cancelar la operación', () => {
  it('no pide ningún valor y confirma sin monto', () => {
    const { onConfirmar } = abrir(VENTA, { estado: 'CANCELADA' })
    expect(screen.queryByLabelText('Valor de cierre')).toBeNull()
    fireEvent.click(screen.getByText('Sí, cancelar la operación'))
    expect(onConfirmar).toHaveBeenCalledWith(null)
  })
})

describe('ModalConfirmarCierre — sin estado', () => {
  it('no dibuja nada', () => {
    const { container } = render(
      <ModalConfirmarCierre
        estado={null}
        operacion={null}
        procesando={false}
        onCancelar={() => {}}
        onConfirmar={() => {}}
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})
