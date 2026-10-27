import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { DuplicadoEnBase } from '../../../lib/api/importarLeads'
import { MAX_FILAS_VISIBLES } from './ListaDetalle'
import { PasoRevision } from './PasoRevision'
import type { Revision } from './revisar'
import { conTelefono, normalizada, revisionDe } from './utilesDePrueba'

vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

function mostrar(revision: Revision, onImportar = vi.fn(), onVolver = vi.fn()) {
  const vista = render(
    <MemoryRouter>
      <PasoRevision revision={revision} onVolver={onVolver} onImportar={onImportar} />
    </MemoryRouter>,
  )
  return { ...vista, onImportar, onVolver }
}

/** La tarjeta de un conteo, por su título. */
function tarjeta(titulo: string): HTMLElement {
  // El título también aparece en el resumen del detalle desplegable: acá, el de la tarjeta (<p>).
  const el = screen
    .getAllByText(titulo)
    .find((e) => e.tagName === 'P')
    ?.closest('div')
  if (!el) throw new Error(`sin tarjeta ${titulo}`)
  return el
}

/** Una de cada: 2 y 3 entran, 4 repite a la 2, 5 y 6 ya están en la cuenta, 7 sin nombre. */
function revisionMixta() {
  return revisionDe({
    filas: [
      conTelefono(2),
      conTelefono(3),
      conTelefono(4, { telefono: '223 555-1002', telefonoNorm: '549223555' + 1002 }),
      conTelefono(5),
      normalizada(6, { email: 'seis@ejemplo.com' }),
      conTelefono(7, { nombre: '', errores: ['Falta el nombre.'] }),
    ],
    base: new Map<number, DuplicadoEnBase | null>([
      [5, 'telefono'],
      [6, 'email'],
    ]),
  })
}

describe('PasoRevision: conteos', () => {
  it('muestra cada categoría con su número y el desglose de "ya están"', () => {
    mostrar(revisionMixta())

    expect(within(tarjeta('Se importan')).getByText('2')).toBeTruthy()
    expect(within(tarjeta('Repetidos dentro del archivo')).getByText('1')).toBeTruthy()
    const enCuenta = tarjeta('Ya están en tu cuenta')
    expect(within(enCuenta).getByText('2')).toBeTruthy()
    expect(within(enCuenta).getByText('por teléfono 1 · por email 1')).toBeTruthy()
    expect(within(tarjeta('Con errores')).getByText('1')).toBeTruthy()
  })

  it('las categorías en 0 se ven atenuadas y las que tienen algo, no', () => {
    mostrar(revisionDe({ filas: [conTelefono(2), conTelefono(3)] }))

    expect(tarjeta('Se importan').className).not.toContain('opacity-60')
    expect(tarjeta('Repetidos dentro del archivo').className).toContain('opacity-60')
    expect(tarjeta('Ya están en tu cuenta').className).toContain('opacity-60')
    expect(tarjeta('Con errores').className).toContain('opacity-60')
  })

  it('sin duplicados ni errores no hay detalle desplegable', () => {
    const { container } = mostrar(revisionDe({ filas: [conTelefono(2)] }))
    expect(container.querySelectorAll('details')).toHaveLength(0)
  })
})

describe('PasoRevision: cupo', () => {
  const dosFilas = [conTelefono(2), conTelefono(3)]

  it('con tope que no alcanza: avisa cuántos entran y cuántos quedan afuera, y ofrece los planes', () => {
    mostrar(revisionDe({ filas: dosFilas, cupo: { limite: 3, usados: 2 } }))

    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain('Tu plan permite cargar 1 lead más.')
    expect(aviso.textContent).toContain('Van a entrar los primeros 1 y los otros 1 quedan afuera.')
    expect(within(aviso).getByRole('link', { name: /Ver planes/ })).toBeTruthy()

    expect(within(tarjeta('Se importan')).getByText('1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Importar 1 lead' })).toBeTruthy()
  })

  it('sin tope no muestra nada de cupo', () => {
    mostrar(revisionDe({ filas: dosFilas, cupo: { limite: null, usados: 500 } }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Importar 2 leads' })).toBeTruthy()
  })

  it('con tope que alcanza no muestra nada de cupo', () => {
    mostrar(revisionDe({ filas: dosFilas, cupo: { limite: 200, usados: 10 } }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/Ver planes/)).toBeNull()
  })

  it('agotado: lo explica y el botón de importar queda deshabilitado', () => {
    mostrar(revisionDe({ filas: dosFilas, cupo: { limite: 10, usados: 10 } }))

    expect(screen.getByRole('alert').textContent).toContain('no tiene lugar')
    const boton = screen.getByRole('button', { name: 'No hay leads para importar' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
  })

  it('sin nada para importar el botón también queda deshabilitado', () => {
    mostrar(revisionDe({ filas: [conTelefono(2, { nombre: '', errores: ['Falta el nombre.'] })] }))
    expect((screen.getByRole('button', { name: 'No hay leads para importar' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('PasoRevision: avisos de calidad', () => {
  it('cuenta las filas sin forma de detectar duplicados y los teléfonos dudosos', () => {
    mostrar(
      revisionDe({
        filas: [
          conTelefono(2),
          normalizada(3), // sin teléfono ni email
          normalizada(4), // ídem
          normalizada(5, { telefono: '+1 310 555 0108', telefonoNorm: '54913105550108', telefonoDudoso: true }),
        ],
      }),
    )

    expect(screen.getByText(/3 filas no tienen teléfono ni email válidos/)).toBeTruthy()
    expect(screen.getByText(/Si volvés a subir este archivo, esas filas se duplican/)).toBeTruthy()
    expect(screen.getByText(/1 teléfono no parece un celular argentino válido/)).toBeTruthy()
  })

  it('sin problemas no hay avisos de calidad', () => {
    mostrar(revisionDe({ filas: [conTelefono(2)] }))
    expect(screen.queryByText(/no se pueden detectar duplicados|no parece/)).toBeNull()
  })
})

describe('PasoRevision: detalle', () => {
  it('lista fila, nombre y motivo de cada categoría', () => {
    mostrar(revisionMixta())

    expect(screen.getByText('Repite el teléfono de la fila 2.')).toBeTruthy()
    expect(screen.getByText('Ya existe un lead con este teléfono en tu cuenta.')).toBeTruthy()
    expect(screen.getByText('Ya existe un lead con este email en tu cuenta.')).toBeTruthy()
    expect(screen.getByText('Falta el nombre.')).toBeTruthy()
  })

  it('"ya están en tu cuenta" nunca muestra datos del lead existente, solo el motivo genérico', () => {
    const { container } = mostrar(revisionMixta())

    const lista = screen.getByText('Ya están en tu cuenta', { selector: 'summary span' }).closest('details') as HTMLElement
    const celdas = Array.from(lista.querySelectorAll('tbody td')).map((td) => td.textContent)
    // Solo fila, nombre (del archivo del usuario) y el motivo fijo.
    expect(celdas).toEqual([
      '5',
      'Lead 5',
      'Ya existe un lead con este teléfono en tu cuenta.',
      '6',
      'Lead 6',
      'Ya existe un lead con este email en tu cuenta.',
    ])
    expect(container.textContent).not.toMatch(/agente|asignad|propietari|de otro/i)
  })

  it('muestra hasta 50 filas por lista y resume el resto', () => {
    const filas = Array.from({ length: 60 }, (_, i) => normalizada(i + 2, { nombre: '', errores: ['Falta el nombre.'] }))
    mostrar(revisionDe({ filas }))

    const lista = screen.getByText(/Con errores \(no se importan\)/).closest('details') as HTMLElement
    expect(lista.querySelectorAll('tbody tr')).toHaveLength(MAX_FILAS_VISIBLES)
    expect(within(lista).getByText('y 10 más')).toBeTruthy()
  })

  it('las filas que se importan con avisos tienen su lista', () => {
    mostrar(revisionDe({ filas: [conTelefono(2, { avisos: ['No entendimos la fecha "mañana": se usa la de hoy.'] })] }))
    expect(screen.getByText(/Se importan, pero con avisos/)).toBeTruthy()
    expect(screen.getByText(/No entendimos la fecha/)).toBeTruthy()
  })
})

describe('PasoRevision: botones', () => {
  it('Volver avisa al padre', () => {
    const { onVolver } = mostrar(revisionMixta())
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onVolver).toHaveBeenCalledOnce()
  })

  it('el botón de importar no se puede disparar dos veces', () => {
    const { onImportar } = mostrar(revisionMixta())
    const boton = screen.getByRole('button', { name: 'Importar 2 leads' }) as HTMLButtonElement

    fireEvent.click(boton)
    fireEvent.click(boton)
    fireEvent.click(boton)

    expect(onImportar).toHaveBeenCalledOnce()
    expect(boton.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
