import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventoCalendario } from '../../hooks/useTareas'
import { GrillaHoraria } from './GrillaHoraria'

const DIA = '2026-11-12'

function evento(extra: Partial<EventoCalendario> & Pick<EventoCalendario, 'id' | 'tipo' | 'titulo'>): EventoCalendario {
  return { fecha: DIA, hora: null, raw: {} as never, ...extra }
}

function montar(eventos: EventoCalendario[], dias: string[] = [DIA]) {
  const onSelectDia = vi.fn()
  render(
    <GrillaHoraria dias={dias} eventos={eventos} diaSeleccionado={DIA} onSelectDia={onSelectDia} />,
  )
  return { onSelectDia }
}

describe('GrillaHoraria', () => {
  it('día vacío: eje de horas y ningún bloque ni franja "todo el día"', () => {
    montar([])
    expect(screen.getByRole('region', { name: 'Agenda por hora' })).toBeTruthy()
    expect(screen.queryByText('Todo el día')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('muestra hora y título de cada bloque', () => {
    montar([
      evento({ id: 'v', tipo: 'VISITA', titulo: 'Visita: Güemes 2450', hora: '10:00', estadoVisita: 'AGENDADA' }),
    ])
    const bloque = screen.getByRole('button', { name: '10:00 Visita: Güemes 2450' })
    expect(bloque.textContent).toContain('10:00')
    expect(bloque.textContent).toContain('Visita: Güemes 2450')
  })

  it('posiciona por hora y le da 45 min a la visita y 30 min a la tarea', () => {
    montar([
      evento({ id: 'v', tipo: 'VISITA', titulo: 'V', hora: '09:00' }),
      evento({ id: 't', tipo: 'TAREA', titulo: 'T', hora: '11:00' }),
    ])
    const visita = screen.getByRole('button', { name: '09:00 V' })
    const tarea = screen.getByRole('button', { name: '11:00 T' })
    // 56px por hora: 9:00 → 504px, 45 min → 42px; 11:00 → 616px, 30 min → 28px.
    expect(visita.style.top).toBe('504px')
    expect(visita.style.height).toBe('42px')
    expect(tarea.style.top).toBe('616px')
    expect(tarea.style.height).toBe('28px')
  })

  it('los superpuestos van lado a lado y no se tapan', () => {
    montar([
      evento({ id: 'a', tipo: 'VISITA', titulo: 'A', hora: '10:00' }),
      evento({ id: 'b', tipo: 'TAREA', titulo: 'B', hora: '10:15' }),
    ])
    const a = screen.getByRole('button', { name: '10:00 A' })
    const b = screen.getByRole('button', { name: '10:15 B' })
    expect(a.style.width).toBe('calc(50% - 4px)')
    expect(b.style.width).toBe('calc(50% - 4px)')
    expect(a.style.left).toBe('calc(0% + 2px)')
    expect(b.style.left).toBe('calc(50% + 2px)')
  })

  it('los sin hora van a la franja "todo el día" y no a la grilla', () => {
    montar([
      evento({ id: 't', tipo: 'TAREA', titulo: 'Llamar al escribano' }),
      evento({ id: 'v', tipo: 'VISITA', titulo: 'Visita: Alvear 3355', hora: '16:00' }),
    ])
    const franja = screen.getByText('Todo el día').parentElement as HTMLElement
    expect(within(franja).getByRole('button', { name: 'Llamar al escribano' })).toBeTruthy()
    expect(within(franja).queryByText(/Alvear/)).toBeNull()
    expect(screen.getByRole('button', { name: '16:00 Visita: Alvear 3355' }).style.top).toBe('896px')
  })

  it('de madrugada y de noche aparecen en la grilla', () => {
    montar([
      evento({ id: 'a', tipo: 'TAREA', titulo: 'Madrugada', hora: '00:30' }),
      evento({ id: 'b', tipo: 'VISITA', titulo: 'Noche', hora: '23:45' }),
    ])
    expect(screen.getByRole('button', { name: '00:30 Madrugada' })).toBeTruthy()
    const noche = screen.getByRole('button', { name: '23:45 Noche' })
    // Recortado contra las 24:00 y con el piso de alto: nunca se sale del eje (1344px).
    expect(Number.parseFloat(noche.style.top) + Number.parseFloat(noche.style.height)).toBeLessThanOrEqual(1344)
  })

  it('las visitas realizadas o canceladas se atenúan; las agendadas no', () => {
    montar([
      evento({ id: 'a', tipo: 'VISITA', titulo: 'Agendada', hora: '09:00', estadoVisita: 'AGENDADA' }),
      evento({ id: 'r', tipo: 'VISITA', titulo: 'Realizada', hora: '11:00', estadoVisita: 'REALIZADA' }),
      evento({ id: 'c', tipo: 'VISITA', titulo: 'Cancelada', hora: '13:00', estadoVisita: 'CANCELADA' }),
    ])
    expect(screen.getByRole('button', { name: '09:00 Agendada' }).className).not.toContain('opacity-55')
    expect(screen.getByRole('button', { name: '11:00 Realizada' }).className).toContain('opacity-55')
    expect(screen.getByRole('button', { name: '13:00 Cancelada' }).className).toContain('opacity-55')
  })

  it('usa los mismos colores que los chips del mes', () => {
    montar([
      evento({ id: 'v', tipo: 'VISITA', titulo: 'V', hora: '09:00' }),
      evento({ id: 's', tipo: 'SEGUIMIENTO', titulo: 'S', hora: '10:00' }),
      evento({ id: 't', tipo: 'TAREA', titulo: 'T', hora: '11:00' }),
    ])
    expect(screen.getByRole('button', { name: '09:00 V' }).className).toContain('bg-warm-soft')
    expect(screen.getByRole('button', { name: '10:00 S' }).className).toContain('bg-cool-soft')
    expect(screen.getByRole('button', { name: '11:00 T' }).className).toContain('bg-brand-soft')
  })

  it('click en un bloque selecciona su día', () => {
    const { onSelectDia } = montar([evento({ id: 'v', tipo: 'VISITA', titulo: 'V', hora: '09:00' })])
    fireEvent.click(screen.getByRole('button', { name: '09:00 V' }))
    expect(onSelectDia).toHaveBeenCalledWith(DIA)
  })

  it('doble click en un hueco vacío no hace nada', () => {
    const { onSelectDia } = montar([])
    fireEvent.doubleClick(screen.getByRole('region', { name: 'Agenda por hora' }))
    expect(onSelectDia).not.toHaveBeenCalled()
  })

  it('solo pinta los eventos del día que muestra', () => {
    montar([
      evento({ id: 'a', tipo: 'TAREA', titulo: 'De hoy', hora: '09:00' }),
      evento({ id: 'b', tipo: 'TAREA', titulo: 'De otro día', hora: '09:00', fecha: '2026-11-13' }),
    ])
    expect(screen.queryByRole('button', { name: '09:00 De otro día' })).toBeNull()
  })

  it('con varios días, una columna por día con su encabezado', () => {
    montar(
      [evento({ id: 'b', tipo: 'TAREA', titulo: 'Viernes', hora: '09:00', fecha: '2026-11-13' })],
      ['2026-11-12', '2026-11-13'],
    )
    expect(screen.getByText('13')).toBeTruthy()
    expect(screen.getByRole('button', { name: '09:00 Viernes' })).toBeTruthy()
  })
})
