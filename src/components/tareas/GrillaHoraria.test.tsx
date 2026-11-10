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

  it('en un solo día no hay encabezado de día', () => {
    montar([])
    expect(screen.queryByRole('button', { name: /jueves/ })).toBeNull()
  })
})

const SEMANA = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
]

describe('GrillaHoraria — semana', () => {
  it('siete encabezados, de lunes a domingo, con día de la semana y número', () => {
    montar([], SEMANA)
    const encabezados = SEMANA.map((_, i) =>
      screen.getByRole('button', {
        name: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i] + ', ' + (9 + i) + ' de noviembre',
      }),
    )
    expect(encabezados).toHaveLength(7)
    expect(encabezados[0].textContent).toMatch(/lun\s*9/i)
    expect(encabezados[6].textContent).toMatch(/dom\s*15/i)
  })

  it('click en un encabezado selecciona ese día', () => {
    const { onSelectDia } = montar([], SEMANA)
    fireEvent.click(screen.getByRole('button', { name: /sábado, 14/ }))
    expect(onSelectDia).toHaveBeenCalledWith('2026-11-14')
  })

  it('marca el día seleccionado y solo ese', () => {
    montar([], SEMANA)
    const marcados = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(marcados).toHaveLength(1)
    expect(marcados[0].getAttribute('aria-label')).toMatch(/jueves, 12/)
  })

  it('marca la columna de hoy con aria-current', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 11, 10, 0, 0))
    try {
      montar([], SEMANA)
      const hoy = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'date')
      expect(hoy).toHaveLength(1)
      expect(hoy[0].getAttribute('aria-label')).toMatch(/miércoles, 11/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cada bloque cae en la columna de su día', () => {
    montar(
      [
        evento({ id: 'a', tipo: 'TAREA', titulo: 'Lunes', hora: '09:00', fecha: '2026-11-09' }),
        evento({ id: 'b', tipo: 'TAREA', titulo: 'Domingo', hora: '09:00', fecha: '2026-11-15' }),
      ],
      SEMANA,
    )
    const lunes = screen.getByRole('button', { name: '09:00 Lunes' })
    const domingo = screen.getByRole('button', { name: '09:00 Domingo' })
    expect(lunes.parentElement).not.toBe(domingo.parentElement)
    // Cada uno ocupa su columna entera: la superposición es por día, no entre días.
    expect(lunes.style.width).toBe('calc(100% - 4px)')
    expect(domingo.style.width).toBe('calc(100% - 4px)')
  })

  it('la superposición se calcula por día: lo que choca va lado a lado, lo de otro día no', () => {
    montar(
      [
        evento({ id: 'a', tipo: 'VISITA', titulo: 'A', hora: '10:00', fecha: '2026-11-10' }),
        evento({ id: 'b', tipo: 'TAREA', titulo: 'B', hora: '10:15', fecha: '2026-11-10' }),
        evento({ id: 'c', tipo: 'TAREA', titulo: 'C', hora: '10:15', fecha: '2026-11-11' }),
      ],
      SEMANA,
    )
    expect(screen.getByRole('button', { name: '10:00 A' }).style.width).toBe('calc(50% - 4px)')
    expect(screen.getByRole('button', { name: '10:15 B' }).style.width).toBe('calc(50% - 4px)')
    expect(screen.getByRole('button', { name: '10:15 C' }).style.width).toBe('calc(100% - 4px)')
  })

  it('"todo el día" de distintos días queda en la misma fila, una celda por columna', () => {
    montar(
      [
        evento({ id: 'a', tipo: 'TAREA', titulo: 'Del martes', fecha: '2026-11-10' }),
        evento({ id: 'b', tipo: 'TAREA', titulo: 'Del viernes', fecha: '2026-11-13' }),
      ],
      SEMANA,
    )
    const fila = screen.getByText('Todo el día').parentElement as HTMLElement
    // El eje y las siete columnas: una sola fila de la grilla.
    expect(fila.children).toHaveLength(8)
    const celdaMartes = screen.getByRole('button', { name: 'Del martes' }).parentElement
    const celdaViernes = screen.getByRole('button', { name: 'Del viernes' }).parentElement
    expect(celdaMartes?.parentElement).toBe(fila)
    expect(celdaViernes?.parentElement).toBe(fila)
    expect(celdaMartes).not.toBe(celdaViernes)
  })

  it('cada columna tiene un ancho mínimo: en pantallas angostas scrollea en horizontal', () => {
    montar([], SEMANA)
    const region = screen.getByRole('region', { name: 'Agenda por hora' })
    expect((region.firstElementChild as HTMLElement).style.minWidth).toBe('48.75rem')
    expect(region.className).toContain('overflow-auto')
  })

  it('el scroll inicial mira toda la semana: arranca antes del primer evento de cualquier día', () => {
    montar(
      [
        evento({ id: 'a', tipo: 'TAREA', titulo: 'Temprano', hora: '05:00', fecha: '2026-11-14' }),
        evento({ id: 'b', tipo: 'TAREA', titulo: 'Tarde', hora: '15:00', fecha: '2026-11-10' }),
      ],
      SEMANA,
    )
    // 30 min antes de las 5:00 = 4:30 → 4,5 h × 56px.
    expect(screen.getByRole('region', { name: 'Agenda por hora' }).scrollTop).toBe(252)
  })

  it('sin nada antes de las 7:00, arranca a las 6:30', () => {
    montar([evento({ id: 'a', tipo: 'TAREA', titulo: 'T', hora: '15:00', fecha: '2026-11-10' })], SEMANA)
    expect(screen.getByRole('region', { name: 'Agenda por hora' }).scrollTop).toBe(364)
  })

  it('atenúa las visitas realizadas y canceladas en cualquier columna', () => {
    montar(
      [evento({ id: 'r', tipo: 'VISITA', titulo: 'R', hora: '11:00', fecha: '2026-11-13', estadoVisita: 'REALIZADA' })],
      SEMANA,
    )
    expect(screen.getByRole('button', { name: '11:00 R' }).className).toContain('opacity-55')
  })
})

