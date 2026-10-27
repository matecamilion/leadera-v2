import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FiltroAlcance } from './FiltroAlcance'
import { SelectorFiltro } from './SelectorFiltro'
import { SelectorTipoLeads } from './SelectorTipoLeads'

const OPCIONES = [
  { valor: 'a', label: 'Uno' },
  { valor: 'b', label: 'Dos' },
  { valor: 'c', label: 'Tres' },
]

function selector(valor = 'a', extra: { destacado?: boolean } = {}) {
  const onCambiar = vi.fn()
  const vista = render(
    <div>
      <SelectorFiltro
        etiqueta="Orden"
        valor={valor}
        opciones={OPCIONES}
        onCambiar={onCambiar}
        {...extra}
      />
      <button type="button">afuera</button>
    </div>,
  )
  return { onCambiar, ...vista }
}

const boton = () => screen.getByRole('combobox', { name: /Orden/ })
const abierto = () => boton().getAttribute('aria-expanded') === 'true'
const tecla = (key: string) => fireEvent.keyDown(boton(), { key })
const activa = () => {
  const id = boton().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id)!.textContent : null
}

describe('SelectorFiltro', () => {
  it('muestra la etiqueta y el valor actual, cerrado', () => {
    selector('b')
    expect(boton().textContent).toBe('OrdenDos')
    expect(boton().getAttribute('aria-haspopup')).toBe('listbox')
    expect(abierto()).toBe(false)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('abre y cierra con clic', () => {
    selector()
    fireEvent.click(boton())
    expect(abierto()).toBe(true)
    expect(boton().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id)
    fireEvent.click(boton())
    expect(abierto()).toBe(false)
  })

  it('Escape cierra y deja el foco en el botón', () => {
    selector()
    boton().focus()
    fireEvent.click(boton())
    tecla('Escape')
    expect(abierto()).toBe(false)
    expect(document.activeElement).toBe(boton())
  })

  it('un clic afuera cierra', () => {
    selector()
    fireEvent.click(boton())
    fireEvent.mouseDown(screen.getByText('afuera'))
    expect(abierto()).toBe(false)
  })

  it('Tab cierra', () => {
    selector()
    fireEvent.click(boton())
    tecla('Tab')
    expect(abierto()).toBe(false)
  })

  it('marca aria-selected solo en la opción elegida, con su check', () => {
    selector('b')
    fireEvent.click(boton())
    const opciones = screen.getAllByRole('option')
    expect(opciones.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(opciones[1].querySelector('svg')).not.toBeNull()
    expect(opciones[0].querySelector('svg')).toBeNull()
  })

  it('elegir con clic informa el valor y cierra', () => {
    const { onCambiar } = selector()
    fireEvent.click(boton())
    fireEvent.click(screen.getByRole('option', { name: 'Tres' }))
    expect(onCambiar).toHaveBeenCalledWith('c')
    expect(abierto()).toBe(false)
  })

  it('elegir el valor que ya estaba cierra sin avisar', () => {
    const { onCambiar } = selector()
    fireEvent.click(boton())
    fireEvent.click(screen.getByRole('option', { name: 'Uno' }))
    expect(onCambiar).not.toHaveBeenCalled()
    expect(abierto()).toBe(false)
  })

  it('flechas, Home y End mueven la opción activa; Enter elige', () => {
    const { onCambiar } = selector('b')
    boton().focus()
    tecla('ArrowDown')
    expect(abierto()).toBe(true)
    expect(activa()).toBe('Dos')
    tecla('ArrowDown')
    expect(activa()).toBe('Tres')
    tecla('ArrowDown')
    expect(activa()).toBe('Tres')
    tecla('Home')
    expect(activa()).toBe('Uno')
    tecla('ArrowUp')
    expect(activa()).toBe('Uno')
    tecla('End')
    expect(activa()).toBe('Tres')
    tecla('Enter')
    expect(onCambiar).toHaveBeenCalledWith('c')
    expect(abierto()).toBe(false)
  })

  it('Espacio elige la opción activa', () => {
    const { onCambiar } = selector()
    tecla(' ')
    tecla('ArrowDown')
    tecla(' ')
    expect(onCambiar).toHaveBeenCalledWith('b')
  })

  it('destacado pinta el borde en primario; sin él, no', () => {
    const { unmount } = selector('a')
    expect(boton().classList.contains('border-primary')).toBe(false)
    unmount()
    selector('b', { destacado: true })
    expect(boton().classList.contains('border-primary')).toBe(true)
  })
})

describe('SelectorTipoLeads', () => {
  const tipo = () => screen.getByRole('combobox', { name: /Tipo/ })

  it('con "Todos los tipos" no se destaca; con un tipo, sí', () => {
    const { rerender } = render(<SelectorTipoLeads valor={undefined} onCambiar={() => {}} />)
    expect(tipo().textContent).toBe('TipoTodos los tipos')
    expect(tipo().classList.contains('border-primary')).toBe(false)

    rerender(<SelectorTipoLeads valor="compradores" onCambiar={() => {}} />)
    expect(tipo().classList.contains('border-primary')).toBe(true)
  })

  it('elegir un tipo informa su valor; "Todos los tipos" informa undefined', () => {
    const onCambiar = vi.fn()
    render(<SelectorTipoLeads valor="vendedores" onCambiar={onCambiar} />)
    fireEvent.click(tipo())
    fireEvent.click(screen.getByRole('option', { name: 'Alquileres' }))
    expect(onCambiar).toHaveBeenLastCalledWith('alquileres')
    fireEvent.click(tipo())
    fireEvent.click(screen.getByRole('option', { name: 'Todos los tipos' }))
    expect(onCambiar).toHaveBeenLastCalledWith(undefined)
  })
})

describe('FiltroAlcance', () => {
  it('marca el activo y avisa el cambio', () => {
    const onCambiar = vi.fn()
    render(<FiltroAlcance mios onCambiar={onCambiar} />)
    expect(screen.getByRole('button', { name: 'Míos' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(onCambiar).toHaveBeenCalledWith(false)
  })
})
