import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VisitaConContexto } from '../../lib/api/visitas'

const mocks = vi.hoisted(() => ({
  listarVisitas: vi.fn(),
  mutate: vi.fn(),
  perfil: { id: 'ana', rol: 'AGENTE', asiste_a: null as string | null },
  equipo: [] as unknown[],
}))

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: mocks.perfil, user: { id: mocks.perfil.id } }),
}))
vi.mock('../../hooks/useEquipo', () => ({ useEquipo: () => ({ data: mocks.equipo }) }))
vi.mock('../../hooks/useVisitas', () => ({
  useCrearVisita: () => ({ mutate: mocks.mutate, isPending: false, isError: false }),
}))
vi.mock('../../hooks/useOperacion', () => ({ useOperacionesPorPropiedad: () => ({ data: [] }) }))
vi.mock('../comunes/ComboboxLead', () => ({ ComboboxLead: () => null }))
vi.mock('../comunes/ComboboxPropiedad', () => ({ ComboboxPropiedad: () => null }))
vi.mock('../../lib/api/visitas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/visitas')>()),
  listarVisitas: mocks.listarVisitas,
}))

import { ModalNuevaVisita } from './ModalNuevaVisita'

const DIA = '2099-03-10'

function existente(extra: Partial<VisitaConContexto> = {}): VisitaConContexto {
  return {
    id: 'v1',
    fecha: DIA,
    hora: '10:15:00',
    estado: 'AGENDADA',
    asignado_a: 'ana',
    titulo_externo: null,
    propiedad: { id: 'p1', direccion: 'Güemes 2450', zona: null },
    lead: { id: 'l1', nombre: 'Ana', apellido: 'Pérez' },
    ...extra,
  } as VisitaConContexto
}

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCerrar = vi.fn()
  render(
    <QueryClientProvider client={cliente}>
      <ModalNuevaVisita fechaInicial={DIA} onCerrar={onCerrar} />
    </QueryClientProvider>,
  )
  // Modo externo: solo hace falta un título para que el formulario sea válido.
  fireEvent.click(screen.getByRole('button', { name: 'Externa' }))
  fireEvent.change(screen.getByLabelText(/Título o dirección/), { target: { value: 'Alvear 3355' } })
  return { onCerrar }
}

const ponerHora = (valor: string) =>
  fireEvent.change(screen.getByLabelText(/^Hora/), { target: { value: valor } })
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Agendar visita' }))
const botonDelPie = (nombre: string) => screen.getByRole('button', { name: nombre }) as HTMLButtonElement

beforeEach(() => {
  mocks.listarVisitas.mockReset()
  mocks.mutate.mockReset()
  mocks.perfil = { id: 'ana', rol: 'AGENTE', asiste_a: null }
  mocks.equipo = []
})

describe('ModalNuevaVisita — aviso de visitas pegadas', () => {
  it('con conflicto muestra el cartel informativo y no agenda todavía', async () => {
    mocks.listarVisitas.mockResolvedValue([existente()])
    montar()
    ponerHora('10:30')
    enviar()

    const cartel = await screen.findByRole('status')
    expect(cartel.textContent).toContain('Se superpone con otra visita')
    expect(cartel.textContent).toContain('10:15 · Güemes 2450 · con Ana Pérez')
    expect(cartel.textContent).not.toMatch(/30 minutos/)
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.listarVisitas).toHaveBeenCalledWith(DIA, DIA)
  })

  it('el cartel solo ofrece "Cambiar hora"; el botón del pie pasa a "Agendar igual" y queda habilitado', async () => {
    mocks.listarVisitas.mockResolvedValue([existente()])
    montar()
    ponerHora('10:30')
    enviar()
    const cartel = await screen.findByRole('status')

    const botonesDelCartel = Array.from(cartel.querySelectorAll('button')).map((b) => b.textContent)
    expect(botonesDelCartel).toEqual(['Cambiar hora'])
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).toBeNull()
    expect(botonDelPie('Agendar igual').disabled).toBe(false)
    expect(botonDelPie('Cancelar').disabled).toBe(false)
  })

  it('"Agendar igual" guarda sin volver a consultar', async () => {
    mocks.listarVisitas.mockResolvedValue([existente()])
    montar()
    ponerHora('10:30')
    enviar()
    await screen.findByRole('status')
    expect(mocks.listarVisitas).toHaveBeenCalledTimes(1)

    fireEvent.click(botonDelPie('Agendar igual'))

    expect(mocks.mutate).toHaveBeenCalledTimes(1)
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
      fecha: DIA,
      hora: '10:30',
      titulo_externo: 'Alvear 3355',
      asignado_a: 'ana',
    })
    expect(mocks.listarVisitas).toHaveBeenCalledTimes(1)
  })

  it('"Cambiar hora" cierra el cartel, devuelve el foco al campo hora y el pie vuelve a "Agendar visita"', async () => {
    mocks.listarVisitas.mockResolvedValue([existente()])
    montar()
    ponerHora('10:30')
    enviar()
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar hora' }))

    expect(screen.queryByRole('status')).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText(/^Hora/))
    expect(botonDelPie('Agendar visita').disabled).toBe(false)
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it.each([
    ['la hora', () => ponerHora('12:00')],
    ['la fecha', () => fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2099-03-11' } })],
  ])('cambiar %s descarta el cartel y el pie vuelve a "Agendar visita"', async (_nombre, cambiar) => {
    mocks.listarVisitas.mockResolvedValue([existente()])
    montar()
    ponerHora('10:30')
    enviar()
    await screen.findByRole('status')

    cambiar()

    expect(screen.queryByRole('status')).toBeNull()
    expect(botonDelPie('Agendar visita').disabled).toBe(false)
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('cambiar el asignado descarta el cartel', async () => {
    mocks.perfil = { id: 'dueno', rol: 'DUENO', asiste_a: null }
    mocks.equipo = [
      { id: 'dueno', nombre: 'Dani', apellido: 'Dueño', activo: true, asisteA: null },
      { id: 'ana', nombre: 'Ana', apellido: 'Ruiz', activo: true, asisteA: null },
    ]
    mocks.listarVisitas.mockResolvedValue([existente({ asignado_a: 'ana' })])
    montar()
    ponerHora('10:30')
    fireEvent.change(screen.getByLabelText('Quién la hace'), { target: { value: 'ana' } })
    enviar()

    const cartel = await screen.findByRole('status')
    expect(cartel.textContent).toContain('Ana Ruiz ya tiene una visita cerca')

    fireEvent.change(screen.getByLabelText('Quién la hace'), { target: { value: 'dueno' } })

    expect(screen.queryByRole('status')).toBeNull()
    expect(botonDelPie('Agendar visita').disabled).toBe(false)
  })

  it('a 30 minutos no hay conflicto: agenda directo', async () => {
    mocks.listarVisitas.mockResolvedValue([existente({ hora: '10:00:00' })])
    montar()
    ponerHora('10:30')
    enviar()

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sin hora no consulta nada y agenda directo', async () => {
    montar()
    enviar()

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1))
    expect(mocks.listarVisitas).not.toHaveBeenCalled()
  })

  it('si falla la consulta no bloquea: agenda igual', async () => {
    mocks.listarVisitas.mockRejectedValue(new Error('sin red'))
    montar()
    ponerHora('10:30')
    enviar()

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('un envío repetido mientras verifica no dispara una segunda consulta', async () => {
    let resolver: (v: VisitaConContexto[]) => void = () => {}
    mocks.listarVisitas.mockReturnValue(new Promise<VisitaConContexto[]>((r) => (resolver = r)))
    montar()
    ponerHora('10:30')

    const formulario = screen.getByRole('dialog')
    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    expect((screen.getByRole('button', { name: 'Verificando…' }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => resolver([]))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1))
    expect(mocks.listarVisitas).toHaveBeenCalledTimes(1)
  })

  it('un asistente se mide contra las visitas de su agente y nombra al agente', async () => {
    mocks.perfil = { id: 'beto', rol: 'ASISTENTE', asiste_a: 'ana' }
    mocks.equipo = [
      {
        id: 'beto',
        nombre: 'Beto',
        apellido: 'Gómez',
        asisteA: { id: 'ana', nombre: 'Ana Ruiz' },
      },
    ]
    // La visita es de la agente: para el asistente cuenta como suya a efectos del calendario.
    mocks.listarVisitas.mockResolvedValue([existente({ asignado_a: 'ana' })])
    montar()
    ponerHora('10:30')
    enviar()

    const cartel = await screen.findByRole('status')
    expect(cartel.textContent).toContain('Ana Ruiz ya tiene una visita cerca')
    expect(cartel.textContent).toContain('10:15')
    expect(cartel.textContent).not.toContain('Se superpone')
  })

  it('una visita de otra persona no avisa', async () => {
    mocks.listarVisitas.mockResolvedValue([existente({ asignado_a: 'otro' })])
    montar()
    ponerHora('10:30')
    enviar()

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1))
  })
})
