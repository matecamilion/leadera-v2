import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { visitas } = vi.hoisted(() => ({
  visitas: { current: {} as { data?: unknown; isError?: boolean; isPending?: boolean } },
}))

vi.mock('../hooks/useVisitas', () => ({ useVisitasDelPeriodo: () => visitas.current }))
vi.mock('../hooks/useEmbudo', () => ({ useEmbudo: () => ({ isPending: false, data: undefined }) }))
vi.mock('../hooks/usePerfil', () => ({
  useMetricasPerfil: () => ({
    isPending: false,
    isError: false,
    data: {
      activos: 5,
      calientes: 1,
      tibios: 1,
      frios: 1,
      ganadosMes: 0,
      perdidosMes: 0,
      nuevosDelMes: 2,
      interacciones7d: 3,
      tasaConversion: null,
      tiempoRespuestaDias: null,
      origenes: [],
      valorPipelineAbierto: [],
      propiedadesSinMovimiento: [],
      metaMensualGanados: 0,
      diasRestantesMes: 10,
    },
  }),
}))
// Los bloques que no son de esta prueba.
vi.mock('../components/perfil/DonutTemperatura', () => ({ DonutTemperatura: () => null }))
vi.mock('../components/perfil/GraficoEvolucion', () => ({ GraficoEvolucion: () => null }))
vi.mock('../components/perfil/GraficoOrigenes', () => ({ GraficoOrigenes: () => null }))
vi.mock('../components/perfil/MetaMensual', () => ({ MetaMensual: () => null }))
vi.mock('../components/perfil/PipelineAbierto', () => ({ PipelineAbierto: () => null }))
vi.mock('../components/perfil/PropiedadesSinMovimiento', () => ({
  PropiedadesSinMovimiento: () => null,
}))
vi.mock('../components/perfil/Embudo', async (importar) => ({
  ...(await importar<typeof import('../components/perfil/Embudo')>()),
  Embudo: () => null,
}))

import Estadisticas from './Estadisticas'

function tarjeta(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('article') as HTMLElement
}

function montar() {
  render(
    <MemoryRouter>
      <Estadisticas />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  visitas.current = {}
})

describe('Estadísticas — visitas del mes', () => {
  it('muestra las tres cards con su número y el período y el equipo en el contexto', () => {
    visitas.current = { data: { realizadas: 7, agendadas: 3, canceladas: 1 } }
    montar()
    expect(tarjeta('Visitas realizadas').textContent).toContain('7')
    expect(tarjeta('Visitas agendadas').textContent).toContain('3')
    expect(tarjeta('Visitas canceladas').textContent).toContain('1')
    for (const n of ['Visitas realizadas', 'Visitas agendadas', 'Visitas canceladas']) {
      expect(tarjeta(n).textContent).toContain('Este mes')
      expect(tarjeta(n).textContent).toContain('tuyas y de tu equipo')
    }
  })

  it('"agendadas" aclara que incluye las que todavía no se marcaron como realizadas', () => {
    visitas.current = { data: { realizadas: 0, agendadas: 2, canceladas: 0 } }
    montar()
    expect(tarjeta('Visitas agendadas').textContent).toContain(
      'incluye las que todavía no se marcaron como realizadas',
    )
  })

  it('mes sin visitas: muestra 0, no un guion', () => {
    visitas.current = { data: { realizadas: 0, agendadas: 0, canceladas: 0 } }
    montar()
    expect(tarjeta('Visitas realizadas').textContent).toContain('0')
    expect(tarjeta('Visitas realizadas').textContent).not.toContain('—')
  })

  it('mientras carga: guion, sin 0 inventado, y el resto de la pantalla ya está', () => {
    visitas.current = { isPending: true }
    montar()
    expect(tarjeta('Visitas realizadas').textContent).toContain('—')
    // Las cards de siempre no esperan a las visitas.
    expect(tarjeta('Leads activos').textContent).toContain('5')
  })

  it('con error: guion y lo dice en la card', () => {
    visitas.current = { isError: true }
    montar()
    expect(tarjeta('Visitas agendadas').textContent).toContain('—')
    expect(tarjeta('Visitas agendadas').textContent).toContain('No se pudieron cargar')
  })

  it('sin tasas ni porcentajes en las cards de visitas', () => {
    visitas.current = { data: { realizadas: 4, agendadas: 2, canceladas: 2 } }
    montar()
    for (const n of ['Visitas realizadas', 'Visitas agendadas', 'Visitas canceladas']) {
      expect(tarjeta(n).textContent).not.toContain('%')
    }
  })
})
