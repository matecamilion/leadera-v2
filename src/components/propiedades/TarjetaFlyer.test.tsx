import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, subirFoto } = vi.hoisted(() => ({
  auth: { profile: null as null | Record<string, unknown> },
  subirFoto: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: auth.profile, user: { id: 'u1' } }),
}))
vi.mock('../../lib/api/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/storage')>()),
  subirFotoPropiedad: subirFoto,
}))

import type { PropiedadConPropietario } from '../../lib/api/propiedades'
import { TarjetaFlyer } from './TarjetaFlyer'

const DUENO = { id: 'dueno', rol: 'DUENO', asiste_a: null }
const AGENTE_A = { id: 'agente-a', rol: 'AGENTE', asiste_a: null }
const ASISTENTE_DE_A = { id: 'asist-a', rol: 'ASISTENTE', asiste_a: 'agente-a' }

function propiedad(fotos: number, agente: string | null = 'agente-a'): PropiedadConPropietario {
  return {
    id: 'p1',
    direccion: 'Alvear 3355',
    tipo: 'DEPARTAMENTO',
    zona: 'Centro',
    precio: 100000,
    moneda: 'USD',
    agente_id: agente,
    fotos_urls: Array.from({ length: fotos }, (_, i) => `https://x.test/${i + 1}.jpg`),
  } as unknown as PropiedadConPropietario
}

function envolver(p: PropiedadConPropietario) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TarjetaFlyer propiedad={p} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const archivo = (n: string) => new File(['x'], n, { type: 'image/jpeg' })

function elegir(contenedor: HTMLElement, nombres: string[]) {
  const entrada = contenedor.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(entrada, { target: { files: nombres.map(archivo) } })
}

describe('TarjetaFlyer', () => {
  beforeEach(() => {
    subirFoto.mockReset()
    subirFoto.mockResolvedValue('https://x.test/f.jpg')
    auth.profile = DUENO
  })

  describe('permisos', () => {
    it('mientras el perfil carga no muestra botón ni mensaje de permiso', () => {
      auth.profile = null
      render(envolver(propiedad(1)))
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByText(/Pedile al dueño/)).toBeNull()
      expect(screen.queryByText(/Solo la puede editar/)).toBeNull()
      // El resto de la tarjeta sí está.
      expect(screen.getByText('Subí 2 fotos más para crear el flyer')).toBeTruthy()
    })

    it('quien puede editar ve el botón con su aria-label', () => {
      auth.profile = AGENTE_A
      render(envolver(propiedad(1)))
      expect(screen.getByRole('button', { name: 'Cargar fotos de Alvear 3355' })).toBeTruthy()
    })

    it('el ASISTENTE del agente de la propiedad también', () => {
      auth.profile = ASISTENTE_DE_A
      render(envolver(propiedad(0)))
      expect(screen.getByRole('button', { name: 'Cargar fotos de Alvear 3355' })).toBeTruthy()
    })

    it('un agente ajeno no ve el botón y lee que es de otro', () => {
      auth.profile = { id: 'agente-b', rol: 'AGENTE', asiste_a: null }
      render(envolver(propiedad(1)))
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.getByText('Solo la puede editar su agente asignado o el dueño')).toBeTruthy()
    })

    it('una propiedad sin agente: sólo el dueño ve el botón; el resto, el pedido de asignación', () => {
      render(envolver(propiedad(0, null)))
      expect(screen.getByRole('button', { name: /Cargar fotos/ })).toBeTruthy()
    })

    it('una propiedad sin agente y un agente: pide que se la asignen', () => {
      auth.profile = AGENTE_A
      render(envolver(propiedad(0, null)))
      expect(screen.queryByRole('button')).toBeNull()
      expect(
        screen.getByText('Pedile al dueño que te asigne la propiedad para cargar fotos'),
      ).toBeTruthy()
    })
  })

  describe('texto de lo que falta', () => {
    it('singular y plural', () => {
      const { unmount } = render(envolver(propiedad(2)))
      expect(screen.getByText('Subí 1 foto más para crear el flyer')).toBeTruthy()
      unmount()
      render(envolver(propiedad(0)))
      expect(screen.getByText('Subí 3 fotos más para crear el flyer')).toBeTruthy()
    })
  })

  describe('con fotos suficientes', () => {
    it('es un link al editor y no tiene botón de carga', () => {
      render(envolver(propiedad(3)))
      expect(screen.getByRole('link').getAttribute('href')).toBe('/flyers/p1')
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByText(/Listo para crear el flyer/)).toBeNull()
    })

    it('el botón no está dentro del link', () => {
      const { container } = render(envolver(propiedad(2)))
      expect(container.querySelector('a')).toBeNull()
      expect(container.querySelector('a button')).toBeNull()
    })
  })

  describe('la carga', () => {
    it('muestra el progreso y deshabilita el botón mientras sube', async () => {
      let soltar: () => void = () => {}
      subirFoto.mockImplementation(() => new Promise<string>((r) => (soltar = () => r('u'))))

      const { container } = render(envolver(propiedad(0)))
      elegir(container, ['a.jpg', 'b.jpg'])

      const boton = await screen.findByRole('button', { name: 'Cargar fotos de Alvear 3355' })
      await waitFor(() => expect(boton.textContent).toContain('Subiendo 1 de 2…'))
      expect((boton as HTMLButtonElement).disabled).toBe(true)

      soltar()
      await waitFor(() => expect(boton.textContent).toContain('Subiendo 2 de 2…'))
      soltar()
      await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
    })

    it('al completar 3 pasa a link y queda el estado final sin perderlo', async () => {
      const { container, rerender } = render(envolver(propiedad(1)))
      elegir(container, ['a.jpg', 'b.jpg'])
      await waitFor(() => expect(subirFoto).toHaveBeenCalledTimes(2))

      // La lista se refrescó: la propiedad ya tiene 3 fotos.
      await waitFor(() =>
        expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false),
      )
      rerender(envolver(propiedad(3)))

      expect(screen.getByRole('link').getAttribute('href')).toBe('/flyers/p1')
      expect(screen.getByText('Listo para crear el flyer')).toBeTruthy()
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('si no entran todas, sube las que caben y avisa el máximo', async () => {
      // Con 2 fotos el cupo es 8: eligiendo 9 se descarta 1.
      const { container } = render(envolver(propiedad(2)))
      elegir(container, Array.from({ length: 9 }, (_, i) => `f${i}.jpg`))

      await waitFor(() => expect(subirFoto).toHaveBeenCalledTimes(8))
      expect(await screen.findByText('Se subieron 8; el máximo es 10 fotos por propiedad')).toBeTruthy()
    })

    it('si una falla sigue con las demás y dice cuántas subieron', async () => {
      subirFoto
        .mockResolvedValueOnce('u')
        .mockRejectedValueOnce(new Error('No pudimos leer "b.heic". Probá con otra foto.'))
        .mockResolvedValueOnce('u')

      const { container } = render(envolver(propiedad(0)))
      elegir(container, ['a.jpg', 'b.heic', 'c.jpg'])

      const alerta = await screen.findByRole('alert')
      expect(subirFoto).toHaveBeenCalledTimes(3)
      expect(alerta.textContent).toBe(
        'Se subieron 2 de 3. Falló: Formato no compatible: probá con una foto JPG o PNG',
      )
    })
  })
})
