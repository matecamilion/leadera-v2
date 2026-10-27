import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import { sugerirMapeo, type MapeoColumnas } from '../../../lib/importarLeads/mapeoColumnas'
import { PasoColumnas } from './PasoColumnas'

// Todo inventado.
const ARCHIVO: ArchivoLeido = {
  hoja: 'Hoja1',
  encabezados: ['Cliente', 'Celular', 'Mail', 'Barrio'],
  filas: [
    { numeroFilaOriginal: 2, celdas: { 0: 'María del Carmen Pérez', 1: '223 555-0101', 2: 'MARIA@ejemplo.com', 3: 'Centro' } },
    { numeroFilaOriginal: 3, celdas: { 0: 'Luis', 1: '+1 310 555 0108', 2: 'no-es-un-mail', 3: null } },
    { numeroFilaOriginal: 4, celdas: { 0: null, 1: '223 555-0102', 2: null, 3: null } },
  ],
}

/** Con el estado adentro, como en la página. */
function Conectado({
  inicial,
  onContinuar = () => {},
}: {
  inicial: MapeoColumnas
  onContinuar?: () => void
}) {
  const [mapeo, setMapeo] = useState(inicial)
  return (
    <PasoColumnas
      archivo={ARCHIVO}
      mapeo={mapeo}
      onMapeo={setMapeo}
      onVolver={() => {}}
      onContinuar={onContinuar}
    />
  )
}

describe('PasoColumnas', () => {
  it('arranca con la propuesta de sugerirMapeo', () => {
    render(<Conectado inicial={sugerirMapeo(ARCHIVO.encabezados).mapeo} />)

    expect((screen.getByLabelText('Nombre completo') as HTMLSelectElement).value).toBe('0')
    expect((screen.getByLabelText('Teléfono') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByLabelText('Email') as HTMLSelectElement).value).toBe('2')
    expect((screen.getByLabelText('Apellido') as HTMLSelectElement).value).toBe('')
  })

  it('cada campo tiene su select con label y las columnas con su letra', () => {
    render(<Conectado inicial={{}} />)

    const select = screen.getByLabelText('Teléfono') as HTMLSelectElement
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['No importar', 'A · Cliente', 'B · Celular', 'C · Mail', 'D · Barrio'])
  })

  it('sin nombre mapeado, Continuar queda deshabilitado y se explica por qué', () => {
    render(<Conectado inicial={{ telefono: 1 }} />)

    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/Nombre o la de Nombre completo/)
  })

  it('al mapear un nombre se habilita y Continuar avisa al padre', () => {
    const onContinuar = vi.fn()
    render(<Conectado inicial={{}} onContinuar={onContinuar} />)

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '0' } })

    const boton = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
    expect(boton.disabled).toBe(false)
    fireEvent.click(boton)
    expect(onContinuar).toHaveBeenCalledOnce()
  })

  it('una columna no queda en dos campos: moverla se la saca al anterior', () => {
    render(<Conectado inicial={{ nombre: 0, telefono: 1 }} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '1' } })

    expect((screen.getByLabelText('Email') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByLabelText('Teléfono') as HTMLSelectElement).value).toBe('')
  })

  it('la vista previa parte el nombre completo y muestra avisos y errores por fila', () => {
    render(<Conectado inicial={sugerirMapeo(ARCHIVO.encabezados).mapeo} />)

    const filas = screen.getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)

    // Fila 2: nombre y apellido partidos, email en minúsculas.
    expect(within(filas[0]).getByText('María')).toBeTruthy()
    expect(within(filas[0]).getByText('del Carmen Pérez')).toBeTruthy()
    expect(within(filas[0]).getByText('maria@ejemplo.com')).toBeTruthy()

    // Fila 3: teléfono dudoso y email inválido => avisos.
    expect(within(filas[1]).getByText(/no parece un celular argentino/)).toBeTruthy()
    expect(within(filas[1]).getByText(/formato válido/)).toBeTruthy()

    // Fila 4: sin nombre => error bloqueante.
    expect(within(filas[2]).getByText('Falta el nombre.')).toBeTruthy()
  })

  it('la vista previa muestra como mucho 5 filas y dice cuántas hay', () => {
    const muchas: ArchivoLeido = {
      ...ARCHIVO,
      filas: Array.from({ length: 12 }, (_, i) => ({
        numeroFilaOriginal: i + 2,
        celdas: { 0: `Lead ${i}`, 1: null, 2: null, 3: null },
      })),
    }
    render(
      <PasoColumnas archivo={muchas} mapeo={{ nombre: 0 }} onMapeo={() => {}} onVolver={() => {}} onContinuar={() => {}} />,
    )

    expect(screen.getAllByRole('row').slice(1)).toHaveLength(5)
    expect(screen.getByText(/Mostrando 5 de 12/)).toBeTruthy()
  })
})

describe('PasoColumnas: revisión de duplicados', () => {
  const mapeo = { nombre: 0 }
  const montar = (extra: { verificando?: boolean; errorVerificacion?: string | null }, onContinuar = vi.fn()) => {
    render(
      <PasoColumnas
        archivo={ARCHIVO}
        mapeo={mapeo}
        onMapeo={() => {}}
        onVolver={() => {}}
        onContinuar={onContinuar}
        {...extra}
      />,
    )
    return onContinuar
  }

  it('mientras revisa: el botón dice que está revisando y queda deshabilitado, igual que Volver', () => {
    montar({ verificando: true })

    const boton = screen.getByRole('button', { name: 'Revisando duplicados en tu cuenta…' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('si falla: muestra el mensaje y "Reintentar" vuelve a pedir la revisión', () => {
    const onContinuar = montar({ errorVerificacion: 'Sesión inválida o expirada' })

    expect(screen.getByRole('alert').textContent).toContain('Sesión inválida o expirada')
    // El usuario puede volver al paso anterior.
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onContinuar).toHaveBeenCalledOnce()
  })

  it('sin error ni revisión en curso no hay botón de reintentar', () => {
    montar({})
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })
})
