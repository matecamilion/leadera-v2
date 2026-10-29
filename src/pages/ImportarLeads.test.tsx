import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchivoLeido } from '../lib/importarLeads/leerArchivo'

const { leerArchivo, verificarDuplicados, importarLeads } = vi.hoisted(() => ({
  leerArchivo: vi.fn(),
  verificarDuplicados: vi.fn(),
  importarLeads: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useUid', () => ({ useUid: () => 'usuario-de-prueba' }))
vi.mock('../lib/importarLeads/leerArchivo', async (original) => ({
  ...(await original<typeof import('../lib/importarLeads/leerArchivo')>()),
  leerArchivo,
}))
vi.mock('../lib/api/importarLeads', async (original) => ({
  ...(await original<typeof import('../lib/api/importarLeads')>()),
  verificarDuplicados,
  importarLeads,
}))

import ImportarLeads from './ImportarLeads'

// Todo inventado. La fila 3 repite el teléfono de la 2; la 5 no tiene nombre.
const ARCHIVO: ArchivoLeido = {
  hoja: 'Hoja1',
  encabezados: ['Nombre y apellido', 'Celular', 'Email'],
  filas: [
    { numeroFilaOriginal: 2, celdas: { 0: 'Ana Gómez', 1: '223 555-0101', 2: null } },
    { numeroFilaOriginal: 3, celdas: { 0: 'Ana G', 1: '2235550101', 2: null } },
    { numeroFilaOriginal: 4, celdas: { 0: 'Luis Paz', 1: '223 555-0104', 2: 'luis@ejemplo.com' } },
    { numeroFilaOriginal: 5, celdas: { 0: null, 1: '223 555-0105', 2: null } },
  ],
}

function pagina() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/leads/importar']}>
        <Routes>
          <Route path="/leads/importar" element={<ImportarLeads />} />
          <Route path="/leads" element={<p>Listado de leads</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function llegarAlPaso2() {
  leerArchivo.mockResolvedValueOnce(ARCHIVO)
  const { container } = pagina()
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'leads.csv')] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
  await screen.findByText('Relacioná tus columnas')
}

const CUENTA = { duplicados: new Map([[4, null]]), cupo: { limite: null, usados: 12 } }

beforeEach(() => {
  leerArchivo.mockReset()
  verificarDuplicados.mockReset()
  importarLeads.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('/leads/importar: del paso 2 al 3', () => {
  it('revisa la cuenta con las filas que hay que comparar y recién ahí muestra el paso 3', async () => {
    verificarDuplicados.mockResolvedValueOnce(CUENTA)
    await llegarAlPaso2()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await screen.findByText('Revisá antes de importar')
    // Solo las filas 2 y 4: la 3 repite a la 2 y la 5 no tiene nombre.
    const pedido = verificarDuplicados.mock.calls[0][0] as { fila: number }[]
    expect(pedido.map((f) => f.fila)).toEqual([2, 4])
    expect(screen.getByRole('button', { name: 'Importar 2 leads' })).toBeTruthy()
  })

  it('mientras espera muestra "Revisando…" y no avanza', async () => {
    let responder: (v: unknown) => void = () => {}
    verificarDuplicados.mockReturnValueOnce(new Promise((r) => (responder = r)))
    await llegarAlPaso2()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    const boton = await screen.findByRole('button', { name: 'Revisando duplicados en tu cuenta…' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Revisá antes de importar')).toBeNull()

    responder(CUENTA)
    await screen.findByText('Revisá antes de importar')
  })

  it('si falla no avanza: muestra el error y deja reintentar', async () => {
    verificarDuplicados.mockRejectedValueOnce(new Error('Sesión inválida o expirada'))
    await llegarAlPaso2()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Sesión inválida o expirada')
    expect(screen.queryByText('Revisá antes de importar')).toBeNull()

    verificarDuplicados.mockResolvedValueOnce(CUENTA)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Revisá antes de importar')
  })

  it('volver del paso 3 al 2 conserva las columnas elegidas', async () => {
    verificarDuplicados.mockResolvedValueOnce(CUENTA)
    await llegarAlPaso2()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Revisá antes de importar')

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))

    await screen.findByText('Relacioná tus columnas')
    expect((screen.getByLabelText('Nombre completo') as HTMLSelectElement).value).toBe('0')
    expect((screen.getByLabelText('Teléfono') as HTMLSelectElement).value).toBe('1')
  })
})

describe('/leads/importar: importar', () => {
  async function llegarAlPaso3() {
    verificarDuplicados.mockResolvedValueOnce(CUENTA)
    await llegarAlPaso2()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Revisá antes de importar')
  }

  it('manda el payload sin claves de atribución y muestra el resultado', async () => {
    importarLeads.mockImplementationOnce(
      async (filas: { fila: number }[], opciones: { onProgreso: (a: number, b: number) => void }) => {
        opciones.onProgreso(filas.length, filas.length)
        return { insertados: 2, resultados: filas.map((f) => ({ fila: f.fila, resultado: 'OK' })), corte: null }
      },
    )
    await llegarAlPaso3()

    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 leads' }))

    await screen.findByText('Se importaron 2 leads')
    expect(importarLeads).toHaveBeenCalledOnce()
    const payload = importarLeads.mock.calls[0][0]
    expect(payload.map((f: { fila: number }) => f.fila)).toEqual([2, 4])
    expect(JSON.stringify(payload)).not.toMatch(/agente_id|asignado_a|inmobiliaria_id/)
    // Una repetida en el archivo: ya no es un duplicado omitido, se fusiona en su
    // primera fila (el resumen la cuenta aparte, tarjeta que llega con el Paso 3).
    // La sin nombre cuenta como error.
    expect(screen.getByText('Omitidos por duplicado').closest('div')?.textContent).toContain('0')
    expect(screen.getByText('Con error').closest('div')?.textContent).toContain('1')
    // Desde el resultado no se puede volver a revisar.
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull()
  })

  it('avisa antes de cerrar la pestaña solo mientras importa', async () => {
    let terminar: (v: unknown) => void = () => {}
    importarLeads.mockReturnValueOnce(new Promise((r) => (terminar = r)))
    const agregar = vi.spyOn(window, 'addEventListener')
    const quitar = vi.spyOn(window, 'removeEventListener')
    await llegarAlPaso3()
    expect(agregar.mock.calls.some(([tipo]) => tipo === 'beforeunload')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 leads' }))
    await screen.findByText(/Importando…/)
    expect(agregar.mock.calls.some(([tipo]) => tipo === 'beforeunload')).toBe(true)

    terminar({ insertados: 2, resultados: [], corte: null })
    await screen.findByRole('button', { name: 'Ver mis leads' })
    expect(quitar.mock.calls.some(([tipo]) => tipo === 'beforeunload')).toBe(true)
  })

  it('un doble clic importa una sola vez', async () => {
    importarLeads.mockResolvedValueOnce({ insertados: 2, resultados: [], corte: null })
    await llegarAlPaso3()

    const boton = screen.getByRole('button', { name: 'Importar 2 leads' })
    fireEvent.click(boton)
    fireEvent.click(boton)

    await screen.findByRole('button', { name: 'Ver mis leads' })
    expect(importarLeads).toHaveBeenCalledOnce()
  })

  it('"Importar otro archivo" empieza de cero', async () => {
    importarLeads.mockResolvedValue({ insertados: 2, resultados: [], corte: null })
    await llegarAlPaso3()
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 leads' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Importar otro archivo' }))

    expect(await screen.findByText('Arrastrá tu archivo acá')).toBeTruthy()
  })

  it('"Ver mis leads" va a /leads', async () => {
    importarLeads.mockResolvedValue({ insertados: 2, resultados: [], corte: null })
    await llegarAlPaso3()
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 leads' }))

    await waitFor(() => screen.getByRole('button', { name: 'Ver mis leads' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver mis leads' }))

    expect(await screen.findByText('Listado de leads')).toBeTruthy()
  })
})
