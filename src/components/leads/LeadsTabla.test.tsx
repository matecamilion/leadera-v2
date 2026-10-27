import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { LeadConAsignado } from '../../lib/api/leads'
import { LeadsTabla } from './LeadsTabla'

function lead(id: string, nombre: string, telefono: string | null): LeadConAsignado {
  return {
    id,
    nombre,
    apellido: 'Prueba',
    telefono,
    estado: 'CALIENTE',
    origen: 'MANUAL',
    fecha_ingreso: '2026-10-01T10:00:00Z',
    fecha_ultimo_contacto_real: null,
    fecha_proximo_seguimiento: null,
    asignado: null,
  } as unknown as LeadConAsignado
}

const LEADS = [lead('uno', 'Ana', null), lead('dos', 'Luis', '2235550101')]

function Ubicacion() {
  return <p data-testid="ubicacion">{useLocation().pathname}</p>
}

function pagina(props: Partial<ComponentProps<typeof LeadsTabla>> = {}) {
  const onRegistrar = vi.fn()
  const onEliminar = vi.fn()
  render(
    <MemoryRouter initialEntries={['/leads']}>
      <Routes>
        <Route
          path="/leads"
          element={
            <LeadsTabla
              leads={LEADS}
              ultimaInteraccion={() => null}
              rol={() => null}
              onRegistrar={onRegistrar}
              onEliminar={onEliminar}
              {...props}
            />
          }
        />
        <Route path="/leads/:id" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  )
  return { onRegistrar, onEliminar }
}

describe('LeadsTabla', () => {
  it('el nombre es un link real a la ficha', () => {
    pagina()
    expect(screen.getByRole('link', { name: 'Ana Prueba' }).getAttribute('href')).toBe('/leads/uno')
  })

  it('ya no tiene el botón "Ver"', () => {
    pagina()
    expect(screen.queryByRole('link', { name: 'Ver' })).toBeNull()
  })

  it('clic en el nombre navega a la ficha', () => {
    pagina()
    fireEvent.click(screen.getByRole('link', { name: 'Luis Prueba' }))
    expect(screen.getByTestId('ubicacion').textContent).toBe('/leads/dos')
  })

  it('Registrar y eliminar actúan sin navegar', () => {
    const { onRegistrar, onEliminar } = pagina()
    fireEvent.click(screen.getByRole('button', { name: /Registrar una interacción con Ana/ }))
    fireEvent.click(screen.getByRole('button', { name: /Eliminar el lead Ana/ }))
    expect(onRegistrar).toHaveBeenCalledWith(LEADS[0])
    expect(onEliminar).toHaveBeenCalledWith(LEADS[0])
    expect(screen.queryByTestId('ubicacion')).toBeNull()
  })

  it('WhatsApp es un link externo y no navega la app', () => {
    pagina()
    const whatsapp = screen.getByRole('link', { name: /WhatsApp a Luis/ })
    expect(whatsapp.getAttribute('target')).toBe('_blank')
    fireEvent.click(whatsapp)
    expect(screen.queryByTestId('ubicacion')).toBeNull()
  })

  it('el lead sin teléfono reserva el lugar: mismas acciones en el mismo orden', () => {
    pagina()
    const filas = screen.getAllByRole('row').slice(1)
    for (const fila of filas) {
      const celda = within(fila).getAllByRole('cell').at(-1)!
      // Registrar, lugar de contacto (vacío o con links) y eliminar.
      expect(celda.querySelector('div')!.children).toHaveLength(3)
    }
    expect(screen.queryByRole('link', { name: /Llamar a Ana/ })).toBeNull()
  })
})
