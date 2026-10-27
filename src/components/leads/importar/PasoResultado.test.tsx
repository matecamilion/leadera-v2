import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ResultadoDeImportacion, ResultadoImportacionDeFila } from '../../../lib/api/importarLeads'
import { PasoResultado } from './PasoResultado'
import type { Revision } from './revisar'
import { conTelefono, normalizada, revisionDe } from './utilesDePrueba'

vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

const ok = (fila: number): ResultadoImportacionDeFila => ({ fila, resultado: 'OK' })

function mostrar(
  revision: Revision,
  resultado: ResultadoDeImportacion | null,
  extra: { importando?: boolean; progreso?: { procesadas: number; total: number } | null } = {},
) {
  const onVerLeads = vi.fn()
  const onOtroArchivo = vi.fn()
  render(
    <MemoryRouter>
      <PasoResultado
        revision={revision}
        importando={extra.importando ?? false}
        progreso={extra.progreso ?? null}
        resultado={resultado}
        onVerLeads={onVerLeads}
        onOtroArchivo={onOtroArchivo}
      />
    </MemoryRouter>,
  )
  return { onVerLeads, onOtroArchivo }
}

function tarjeta(titulo: string): HTMLElement {
  const el = screen.getByText(titulo).closest('div')
  if (!el) throw new Error(`sin tarjeta ${titulo}`)
  return el
}

const REVISION = revisionDe({ filas: [conTelefono(2), conTelefono(3), conTelefono(4)] })

describe('PasoResultado: en curso', () => {
  it('muestra la barra con el avance y no ofrece ningún botón', () => {
    mostrar(REVISION, null, { importando: true, progreso: { procesadas: 200, total: 450 } })

    expect(screen.getByRole('status').textContent).toContain('Importando… 200 de 450')
    const barra = screen.getByRole('progressbar', { name: 'Avance de la importación' })
    expect(barra.getAttribute('aria-valuenow')).toBe('200')
    expect(barra.getAttribute('aria-valuemax')).toBe('450')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')

    // Sin cancelar, sin confirmar, sin volver.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/No cierres esta pestaña/)).toBeTruthy()
  })

  it('al arrancar, antes del primer lote, está en 0 de total', () => {
    mostrar(REVISION, null, { importando: true, progreso: { procesadas: 0, total: 3 } })
    expect(screen.getByRole('status').textContent).toContain('Importando… 0 de 3')
  })
})

describe('PasoResultado: éxito total', () => {
  it('muestra los importados y las demás tarjetas en 0', () => {
    mostrar(REVISION, { insertados: 3, resultados: [ok(2), ok(3), ok(4)], corte: null })

    expect(screen.getByText('Se importaron 3 leads')).toBeTruthy()
    expect(within(tarjeta('Importados')).getByText('3')).toBeTruthy()
    expect(tarjeta('Omitidos por duplicado').className).toContain('opacity-60')
    expect(tarjeta('Con error').className).toContain('opacity-60')
    expect(tarjeta('Fuera por el límite del plan').className).toContain('opacity-60')
    expect(screen.queryByText(/Ver planes/)).toBeNull()
    expect(screen.queryByText(/Se interrumpió/)).toBeNull()
  })

  it('un solo lead, en singular', () => {
    mostrar(REVISION, { insertados: 1, resultados: [ok(2)], corte: null })
    expect(screen.getByText('Se importó 1 lead')).toBeTruthy()
  })

  it('"Ver mis leads" y "Importar otro archivo" avisan al padre; no hay Volver', () => {
    const { onVerLeads, onOtroArchivo } = mostrar(REVISION, { insertados: 3, resultados: [ok(2), ok(3), ok(4)], corte: null })

    fireEvent.click(screen.getByRole('button', { name: 'Ver mis leads' }))
    fireEvent.click(screen.getByRole('button', { name: 'Importar otro archivo' }))

    expect(onVerLeads).toHaveBeenCalledOnce()
    expect(onOtroArchivo).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /Volver/ })).toBeNull()
  })
})

describe('PasoResultado: omitidos', () => {
  it('suma lo repetido en el archivo, lo que ya estaba en la cuenta y los EMAIL_DUPLICADO de la base', () => {
    const revision = revisionDe({
      filas: [
        conTelefono(2),
        conTelefono(3, { telefono: '223 555-1002', telefonoNorm: '549223555' + 1002 }), // repite la 2
        conTelefono(4),
        conTelefono(5),
      ],
      base: new Map([[4, 'telefono' as const]]),
    })
    mostrar(revision, {
      insertados: 1,
      resultados: [ok(2), { fila: 5, resultado: 'EMAIL_DUPLICADO' }],
      corte: null,
    })

    // 1 en el archivo + 1 en la cuenta + 1 por carrera.
    expect(within(tarjeta('Omitidos por duplicado')).getByText('3')).toBeTruthy()
    expect(within(tarjeta('Importados')).getByText('1')).toBeTruthy()
  })
})

describe('PasoResultado: tope del plan', () => {
  it('cuenta los LIMITE_ALCANZADO, lo explica y ofrece los planes', () => {
    mostrar(REVISION, {
      insertados: 1,
      resultados: [ok(2), { fila: 3, resultado: 'LIMITE_ALCANZADO' }, { fila: 4, resultado: 'LIMITE_ALCANZADO' }],
      corte: null,
    })

    expect(within(tarjeta('Fuera por el límite del plan')).getByText('2')).toBeTruthy()
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain('2 leads quedaron afuera porque tu plan llegó a su límite')
    expect(within(aviso).getByRole('link', { name: /Ver planes/ })).toBeTruthy()
  })
})

describe('PasoResultado: corte', () => {
  it('avisa que se interrumpió, qué pasó con el último lote y cómo seguir', () => {
    mostrar(REVISION, {
      insertados: 1,
      resultados: [ok(2)],
      corte: { mensaje: 'Se perdió la conexión.', filasSinProcesar: [3, 4] },
    })

    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain('Se interrumpió la importación. Las filas del último lote pueden haber entrado.')
    expect(aviso.textContent).toContain('volvé a subir el mismo archivo')
    expect(aviso.textContent).toContain('se detectan como repetidos y se omiten')
    expect(aviso.textContent).toContain('Se perdió la conexión.')
    expect(aviso.textContent).toContain('2 filas sin procesar')
    // Lo que sí entró se sigue informando.
    expect(within(tarjeta('Importados')).getByText('1')).toBeTruthy()
  })

  it('un corte sin nada insertado no se presenta como "no se importó ningún lead"', () => {
    mostrar(REVISION, {
      insertados: 0,
      resultados: [],
      corte: { mensaje: 'Tu usuario está desactivado.', filasSinProcesar: [2, 3, 4] },
    })
    expect(screen.getByRole('heading', { name: 'La importación se interrumpió' })).toBeTruthy()
    expect(screen.queryByText(/Lo principal/)).toBeNull()
  })
})

describe('PasoResultado: 0 insertados', () => {
  it('neutral, con el motivo principal: todo repetido', () => {
    const revision = revisionDe({
      filas: [conTelefono(2), conTelefono(3)],
      base: new Map([
        [2, 'telefono' as const],
        [3, 'email' as const],
      ]),
    })
    mostrar(revision, { insertados: 0, resultados: [], corte: null })

    expect(screen.getByRole('heading', { name: 'No se importó ningún lead' })).toBeTruthy()
    expect(screen.getByText(/ya estaban en tu cuenta o se repetían/)).toBeTruthy()
  })

  it('el motivo principal puede ser el límite del plan', () => {
    mostrar(REVISION, {
      insertados: 0,
      resultados: [
        { fila: 2, resultado: 'LIMITE_ALCANZADO' },
        { fila: 3, resultado: 'LIMITE_ALCANZADO' },
        { fila: 4, resultado: 'LIMITE_ALCANZADO' },
      ],
      corte: null,
    })
    expect(screen.getByText(/tu plan no tiene lugar para más leads/)).toBeTruthy()
  })

  it('el motivo principal puede ser que las filas tenían errores', () => {
    const revision = revisionDe({
      filas: [normalizada(2, { nombre: '', errores: ['Falta el nombre.'] })],
    })
    mostrar(revision, { insertados: 0, resultados: [], corte: null })
    expect(screen.getByText(/las filas tenían errores/)).toBeTruthy()
  })
})

describe('PasoResultado: errores', () => {
  it('lista los errores de validación y los de la base, con nombre y mensaje', () => {
    const revision = revisionDe({
      filas: [
        conTelefono(2),
        conTelefono(3, { nombre: 'Luis' }),
        normalizada(4, { nombre: '', errores: ['Falta el nombre.'] }),
      ],
    })
    mostrar(revision, {
      insertados: 1,
      resultados: [ok(2), { fila: 3, resultado: 'ERROR', mensaje: 'El nombre supera los 100 caracteres.' }],
      corte: null,
    })

    expect(within(tarjeta('Con error')).getByText('2')).toBeTruthy()
    const lista = screen.getByText('Filas con error', { selector: 'summary span' }).closest('details') as HTMLElement
    const celdas = Array.from(lista.querySelectorAll('tbody td')).map((td) => td.textContent)
    expect(celdas).toEqual(['4', '—', 'Falta el nombre.', '3', 'Luis', 'El nombre supera los 100 caracteres.'])
  })

  it('sin errores no hay lista', () => {
    mostrar(REVISION, { insertados: 3, resultados: [ok(2), ok(3), ok(4)], corte: null })
    expect(screen.queryByText('Filas con error', { selector: 'summary span' })).toBeNull()
  })
})
