import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth } = vi.hoisted(() => ({
  auth: { rol: 'AGENTE' as 'AGENTE' | 'ASISTENTE' | 'DUENO' },
}))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'yo', rol: auth.rol }, user: { id: 'yo' } }),
}))
vi.mock('../hooks/useEquipo', () => ({ useEquipo: () => ({ data: [] }) }))
vi.mock('../hooks/useLeads', () => ({
  LEADS_POR_PAGINA: 20,
  useLeads: () => ({
    data: { data: [], count: 1 },
    isPending: false,
    isError: false,
    error: null,
    isPlaceholderData: false,
  }),
  useConteosPorEstado: () => ({ data: undefined }),
  useHayLeads: () => ({ data: true, isPending: false }),
}))
vi.mock('../hooks/useOperacionesPorLead', () => ({
  useOperacionesPorLead: () => () => ({ venta: 0, compra: 0 }),
  useInteraccionesPorLead: () => () => ({ cantidad: 0, ultimoDetalle: null }),
  useRolesPorLead: () => () => null,
}))

import Leads from './Leads'

function Parametros() {
  return <p data-testid="search">{useLocation().search}</p>
}

function pagina(url = '/leads') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Parametros />
        <Routes>
          <Route path="/leads" element={<Leads />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const search = () => screen.getByTestId('search').textContent

function elegir(combobox: HTMLElement, opcion: string) {
  fireEvent.click(combobox)
  fireEvent.click(screen.getByRole('option', { name: opcion }))
}

describe('filtros del listado de leads', () => {
  beforeEach(() => {
    auth.rol = 'AGENTE'
    localStorage.clear()
  })

  it('Tipo escribe ?rol= y "Todos los tipos" lo saca', () => {
    pagina('/leads?rol=compradores&page=2')
    const tipo = screen.getByRole('combobox', { name: /Tipo/ })
    expect(tipo.textContent).toBe('TipoCompradores')
    expect(tipo.classList.contains('border-primary')).toBe(true)

    elegir(tipo, 'Vendedores')
    expect(search()).toBe('?rol=vendedores')

    elegir(tipo, 'Todos los tipos')
    expect(search()).toBe('')
    expect(tipo.classList.contains('border-primary')).toBe(false)
  })

  it('Ordenar escribe ?orden= y "Prioridad" (default) lo saca', () => {
    pagina()
    const orden = screen.getByRole('combobox', { name: /Ordenar/ })
    elegir(orden, 'Más recientes')
    expect(search()).toBe('?orden=ingreso_desc')
    elegir(orden, 'Prioridad')
    expect(search()).toBe('')
  })

  it('Míos/Todos no aparece para dueño ni agente', () => {
    for (const rol of ['DUENO', 'AGENTE'] as const) {
      auth.rol = rol
      const { unmount } = pagina()
      expect(screen.queryByRole('group', { name: /Alcance/ })).toBeNull()
      unmount()
    }
  })

  it('Míos/Todos aparece para el asistente, arranca en Míos y escribe ?mios=0', () => {
    auth.rol = 'ASISTENTE'
    pagina()
    // Hay otro "Todos" en las pastillas de temperatura: se busca dentro del grupo.
    const alcance = within(screen.getByRole('group', { name: /Alcance/ }))
    expect(alcance.getByRole('button', { name: 'Míos' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(alcance.getByRole('button', { name: 'Todos' }))
    expect(search()).toBe('?mios=0')
  })
})
