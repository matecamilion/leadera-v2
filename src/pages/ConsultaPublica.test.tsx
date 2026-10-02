import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OPERACIONES,
  RANGOS_PRESUPUESTO,
} from '../../supabase/functions/consulta-publica/encuesta.ts'
import { obtenerLink } from '../components/consulta-publica/api'
import type { DatosLink } from '../components/consulta-publica/tipos'
import ConsultaPublica from './ConsultaPublica'

vi.mock('../components/consulta-publica/api', () => ({
  obtenerLink: vi.fn(),
  enviarConsulta: vi.fn(),
}))

const BASE: Omit<DatosLink, 'rangos_presupuesto'> = {
  token: 'slug00000001.0000000000000.firma',
  link: { slug: 'slug00000001', tipo: 'GENERAL', preguntas_off: [] },
  flujo: 'GENERAL',
  operacion_fija: null,
  asesor: { nombre: 'Lucía', apellido: 'Fernández' },
  inmobiliaria: { nombre: 'Costa Propiedades' },
  propiedad: null,
}

/** Lo que manda la edge actual: las 4 operaciones, con moneda. */
const EDGE_ACTUAL: DatosLink = {
  ...BASE,
  rangos_presupuesto: Object.fromEntries(
    OPERACIONES.map((op) => [
      op,
      RANGOS_PRESUPUESTO[op].map(({ codigo, label, moneda }) => ({ codigo, label, moneda })),
    ]),
  ) as DatosLink['rangos_presupuesto'],
}

/**
 * Lo que manda la edge de la primera versión (la que estaba desplegada cuando
 * apareció el bug): solo COMPRA y ALQUILER, sin `moneda`.
 */
const EDGE_ANTERIOR = {
  ...BASE,
  rangos_presupuesto: {
    COMPRA: [
      { codigo: 'USD_0_50K', label: 'Hasta USD 50.000' },
      { codigo: 'USD_250K_MAS', label: 'Más de USD 250.000' },
    ],
    ALQUILER: [
      { codigo: 'ARS_0_400K', label: 'Hasta $400.000' },
      { codigo: 'ARS_400_700K', label: '$400.000 a $700.000' },
      { codigo: 'ARS_1500K_MAS', label: 'Más de $1.500.000' },
    ],
  },
} as unknown as DatosLink

function montar(datos: DatosLink) {
  vi.mocked(obtenerLink).mockResolvedValue({ tipo: 'ok', datos, recibidoEn: 0 })
  render(
    <MemoryRouter initialEntries={['/c/slug00000001']}>
      <Routes>
        <Route path="/c/:slug" element={<ConsultaPublica />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function clic(nombre: string) {
  fireEvent.click(await screen.findByRole('button', { name: nombre }))
}

/** Hasta el paso de precio, haciendo clic como la persona. */
async function irAlPrecio(operacion: string, tipo = 'Departamento') {
  await clic(operacion)
  await clic(tipo)
  await clic('No tengo preferencia')
}

/** Los botones de opciones del paso (los de la lista, no el selector ni "Atrás"). */
function rangos(): string[] {
  const lista = screen.getByRole('list')
  return within(lista)
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
}

describe('paso de precio de alquiler', () => {
  beforeEach(() => vi.mocked(obtenerLink).mockReset())

  it('con la edge actual: hay rangos en pesos y en dólares', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Alquilar una propiedad')

    expect(await screen.findByRole('heading', { name: '¿Cuánto querés pagar por mes?' })).toBeTruthy()
    const enPesos = rangos()
    expect(enPesos.length).toBeGreaterThan(0)
    expect(enPesos.every((r) => r.includes('$'))).toBe(true)

    await clic('Dólares')
    const enDolares = rangos()
    expect(enDolares.length).toBeGreaterThan(0)
    expect(enDolares.every((r) => r.includes('USD'))).toBe(true)
  })

  it('con la edge actual: el propietario ve rangos con cada moneda y la opción de asesorarse', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Poner mi propiedad en alquiler', 'PH')

    expect(await screen.findByRole('heading', { name: '¿Cuánto pretendés por mes?' })).toBeTruthy()
    expect(rangos()).toContain('No sé, quiero que me asesoren')
    expect(rangos().some((r) => r.includes('$'))).toBe(true)

    await clic('Dólares')
    expect(rangos().some((r) => r.includes('USD'))).toBe(true)
    expect(rangos()).toContain('No sé, quiero que me asesoren')
  })

  it('con la edge anterior (sin moneda): muestra sus rangos y no el selector', async () => {
    montar(EDGE_ANTERIOR)
    await irAlPrecio('Alquilar una propiedad')

    expect(await screen.findByRole('heading', { name: '¿Cuánto querés pagar por mes?' })).toBeTruthy()
    expect(rangos()).toEqual(['Hasta $400.000', '$400.000 a $700.000', 'Más de $1.500.000'])
    expect(screen.queryByRole('group', { name: 'Moneda' })).toBeNull()
  })

  it('con la edge anterior: no ofrece operaciones de propietario que la edge rechazaría', async () => {
    montar(EDGE_ANTERIOR)
    expect(await screen.findByRole('button', { name: 'Comprar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Vender mi propiedad' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Poner mi propiedad en alquiler' })).toBeNull()
  })
})
