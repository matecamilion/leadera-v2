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
    expect(within(tarjeta('Consultas fusionadas')).getByText('1')).toBeTruthy()
    const enCuenta = tarjeta('Ya están en tu cuenta')
    expect(within(enCuenta).getByText('2')).toBeTruthy()
    expect(within(enCuenta).getByText('por teléfono 1 · por email 1')).toBeTruthy()
    expect(within(tarjeta('Con errores')).getByText('1')).toBeTruthy()
  })

  it('las categorías en 0 se ven atenuadas y las que tienen algo, no', () => {
    mostrar(revisionDe({ filas: [conTelefono(2), conTelefono(3)] }))

    expect(tarjeta('Se importan').className).not.toContain('opacity-60')
    expect(tarjeta('Consultas fusionadas').className).toContain('opacity-60')
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

    expect(screen.getByText('Se juntaron 2 consultas (filas 2 y 4).')).toBeTruthy()
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

// ---------------------------------------------------------------------------
// Consultas fusionadas y contacto cargado
// ---------------------------------------------------------------------------

/** Un teléfono distinto por persona; las filas de la misma persona lo comparten. */
function dePersona(persona: number, fila: number, cambios: Partial<Parameters<typeof conTelefono>[1]> = {}) {
  const numero = String(1000 + persona).padStart(4, '0')
  return conTelefono(fila, { telefono: `223 555-${numero}`, telefonoNorm: `549223555${numero}`, ...cambios })
}

const consulta = (dia: number, texto: string) => ({ fecha: new Date(2026, 3, dia), texto, propiedad: [] })

/** Persona 1 con 3 consultas (filas 2, 3 y 4), persona 2 con 2 (filas 5 y 6) y la 7 sola. */
function revisionConFusiones() {
  return revisionDe({
    filas: [
      dePersona(1, 2, { consulta: consulta(3, 'Consulta del 03/04/2026\nMensaje: tercera') }),
      dePersona(1, 3, { consulta: consulta(1, 'Consulta del 01/04/2026\nMensaje: primera') }),
      dePersona(1, 4, { consulta: consulta(2, 'Consulta del 02/04/2026\nMensaje: segunda') }),
      dePersona(2, 5, { consulta: consulta(5, 'Consulta del 05/04/2026\nMensaje: unica') }),
      dePersona(2, 6, { consulta: consulta(6, 'Consulta del 06/04/2026\nMensaje: otra') }),
      dePersona(3, 7),
    ],
  })
}

describe('PasoRevision: consultas fusionadas', () => {
  it('la tarjeta cuenta las consultas fusionadas y dice en cuántos leads', () => {
    mostrar(revisionConFusiones())

    const t = tarjeta('Consultas fusionadas')
    // Filas 3, 4 y 6 se juntaron en las filas 2 y 5.
    expect(within(t).getByText('3')).toBeTruthy()
    expect(within(t).getByText('en 2 leads')).toBeTruthy()
  })

  it('con un solo lead lo dice en singular', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2), dePersona(1, 3)] }))
    expect(within(tarjeta('Consultas fusionadas')).getByText('en 1 lead')).toBeTruthy()
  })

  it('aclara que no se pierden: se juntan en un solo lead', () => {
    mostrar(revisionConFusiones())
    expect(screen.getByText(/no se pierden: son de una misma persona y se juntan en un solo lead/)).toBeTruthy()
  })

  it('sin consultas repetidas no hay subtítulo ni aclaración', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2), dePersona(2, 3)] }))
    expect(within(tarjeta('Consultas fusionadas')).queryByText(/^en \d/)).toBeNull()
    expect(screen.queryByText(/no se pierden/)).toBeNull()
  })

  it('ya no se llama "Repetidos dentro del archivo"', () => {
    mostrar(revisionConFusiones())
    expect(screen.queryByText('Repetidos dentro del archivo')).toBeNull()
  })

  it('el desplegable lista un lead por fila con cuántas consultas juntó', () => {
    mostrar(revisionConFusiones())

    const lista = screen.getByText('Leads con varias consultas', { selector: 'summary span' }).closest('details') as HTMLElement
    expect(within(lista).getByText('(2)')).toBeTruthy()
    expect(within(lista).getByText('Se juntaron 3 consultas (filas 2, 3 y 4).')).toBeTruthy()
    expect(within(lista).getByText('Se juntaron 2 consultas (filas 5 y 6).')).toBeTruthy()
    expect(lista.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('cada lead tiene "Ver descripción final" con el texto ya fusionado, en una caja con scroll', () => {
    mostrar(revisionConFusiones())

    const botones = screen.getAllByText('Ver descripción final')
    expect(botones).toHaveLength(2)

    // La de la persona 1: sus tres consultas por fecha ascendente, separadas por ---.
    const caja = botones[0].closest('details')!.querySelector('pre') as HTMLElement
    expect(caja.textContent).toBe(
      'Consulta del 01/04/2026\nMensaje: primera\n---\nConsulta del 02/04/2026\nMensaje: segunda\n---\nConsulta del 03/04/2026\nMensaje: tercera',
    )
    expect(caja.className).toContain('max-h-48')
    expect(caja.className).toContain('overflow-auto')
    // Es un <details>: no se ve hasta que se abre.
    expect(botones[0].closest('details')!.hasAttribute('open')).toBe(false)
  })

  it('un lead fusionado sin descripción no ofrece "Ver descripción final"', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2), dePersona(1, 3)] }))
    expect(screen.queryByText('Ver descripción final')).toBeNull()
  })
})

describe('PasoRevision: resumen de contacto', () => {
  const contacto = (dia: number) => ({ primerContacto: new Date(2026, 3, dia), ultimoContacto: new Date(2026, 3, dia) })
  const resumen = () =>
    screen.queryByText((_, el) => el?.tagName === 'P' && /con contacto cargado/.test(el.textContent ?? ''))

  it('cuenta los que entran con contacto cargado y los que entran como nuevos', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2, contacto(5)), dePersona(2, 3, contacto(6)), dePersona(3, 4)] }))
    expect(resumen()?.textContent).toBe('2 entran con contacto cargado · 1 entra como nuevo')
  })

  it('en singular', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2, contacto(5)), dePersona(2, 3), dePersona(3, 4)] }))
    expect(resumen()?.textContent).toBe('1 entra con contacto cargado · 2 entran como nuevos')
  })

  it('sin ninguno con contacto no se muestra', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2), dePersona(2, 3)] }))
    expect(resumen()).toBeNull()
  })

  it('cuenta solo los que el plan deja entrar', () => {
    // Entran 2 de 3: el tercero, que es el único con contacto, queda afuera.
    mostrar(
      revisionDe({
        filas: [dePersona(1, 2), dePersona(2, 3), dePersona(3, 4, contacto(5))],
        cupo: { limite: 2, usados: 0 },
      }),
    )
    expect(resumen()).toBeNull()
  })

  it('un lead fusionado cuenta como uno, con el contacto que juntó', () => {
    mostrar(revisionDe({ filas: [dePersona(1, 2), dePersona(1, 3, contacto(5)), dePersona(2, 4)] }))
    expect(resumen()?.textContent).toBe('1 entra con contacto cargado · 1 entra como nuevo')
  })
})
