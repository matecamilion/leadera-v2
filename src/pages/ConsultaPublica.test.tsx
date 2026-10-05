import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  limitesMonto,
  OPERACIONES,
  RANGOS_PRESUPUESTO,
} from '../../supabase/functions/consulta-publica/encuesta.ts'
import { obtenerLink } from '../components/consulta-publica/api'
import { armarPayload } from '../components/consulta-publica/pasos'
import type { DatosLink, Respuestas } from '../components/consulta-publica/tipos'
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

/** Lo que manda la edge actual: las 4 operaciones, con moneda y `monto` en los rangos abiertos. */
const EDGE_ACTUAL: DatosLink = {
  ...BASE,
  rangos_presupuesto: Object.fromEntries(
    OPERACIONES.map((op) => [
      op,
      RANGOS_PRESUPUESTO[op].map(({ codigo, label, moneda }) => {
        const monto = limitesMonto(op, codigo)
        return { codigo, label, moneda, ...(monto ? { monto } : {}) }
      }),
    ]),
  ) as DatosLink['rangos_presupuesto'],
}

/** La edge anterior al monto: con moneda, sin `monto`. Rechazaría `presupuesto_monto`. */
const EDGE_SIN_MONTO: DatosLink = {
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

describe('monto del rango abierto', () => {
  beforeEach(() => vi.mocked(obtenerLink).mockReset())

  const NOMBRE_CAMPO = /¿Cuánto, más o menos\?/
  const campo = () => screen.queryByRole<HTMLInputElement>('textbox', { name: NOMBRE_CAMPO })

  async function escribirMonto(valor: string) {
    fireEvent.change(await screen.findByRole('textbox', { name: NOMBRE_CAMPO }), { target: { value: valor } })
  }

  it('aparece solo con el rango abierto, y el rango abierto no avanza solo', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Comprar')
    expect(campo()).toBeNull()

    await clic('Más de USD 700.000')
    expect(screen.getByRole('heading', { name: '¿Cuál es tu presupuesto?' })).toBeTruthy()
    expect(campo()).toBeTruthy()
    expect(screen.getByText('USD')).toBeTruthy()

    // Con otro rango, avanza como siempre.
    await clic('USD 400.000 a 700.000')
    expect(await screen.findByRole('heading', { name: '¿Cómo pensás pagar?' })).toBeTruthy()
  })

  it('formatea con separador de miles mientras se escribe', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Comprar')
    await clic('Más de USD 700.000')
    await escribirMonto('900000')
    expect(campo()?.value).toBe('900.000')
    await escribirMonto('1.2a50000')
    expect(campo()?.value).toBe('1.250.000')
  })

  it('en alquiler en pesos lleva $ y en dólares USD', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Alquilar una propiedad')
    await clic('Más de $2.000.000')
    expect(campo()).toBeTruthy()
    expect(screen.getByText('$')).toBeTruthy()

    await clic('Dólares')
    expect(campo()).toBeNull()
    await clic('Más de USD 2.000')
    expect(campo()).toBeTruthy()
    expect(screen.getByText('USD')).toBeTruthy()
  })

  it('no deja seguir fuera de los límites; sí con el campo vacío', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Comprar')
    await clic('Más de USD 700.000')

    await escribirMonto('500000')
    await clic('Continuar')
    expect(screen.getByText('Tiene que ser de USD 700.000 o más.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '¿Cuál es tu presupuesto?' })).toBeTruthy()

    await escribirMonto('99000000')
    await clic('Continuar')
    expect(screen.getByText('Revisá el monto: el máximo es USD 35.000.000.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '¿Cuál es tu presupuesto?' })).toBeTruthy()

    await escribirMonto('')
    await clic('Continuar')
    expect(await screen.findByRole('heading', { name: '¿Cómo pensás pagar?' })).toBeTruthy()
  })

  it('se borra al elegir otro rango', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Comprar')
    await clic('Más de USD 700.000')
    await escribirMonto('900000')
    await clic('Continuar')

    await clic('Atrás')
    expect(campo()?.value).toBe('900.000')
    await clic('USD 400.000 a 700.000')
    await clic('Atrás')
    await clic('Más de USD 700.000')
    expect(campo()?.value).toBe('')
  })

  it('se borra al cambiar de moneda', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Alquilar una propiedad')
    await clic('Más de $2.000.000')
    await escribirMonto('2500000')
    await clic('Continuar')

    await clic('Atrás')
    expect(campo()?.value).toBe('2.500.000')
    await clic('Dólares')
    await clic('Pesos')
    expect(campo()).toBeNull()
    await clic('Más de $2.000.000')
    expect(campo()?.value).toBe('')
  })

  it('se borra al cambiar de operación', async () => {
    montar(EDGE_ACTUAL)
    await irAlPrecio('Comprar', 'Casa')
    await clic('Más de USD 700.000')
    await escribirMonto('900000')
    await clic('Continuar')

    // Pago → precio → zona → tipo → operación.
    for (let i = 0; i < 4; i++) await clic('Atrás')
    await irAlPrecio('Vender mi propiedad', 'Casa')
    await clic('Más de USD 700.000')
    expect(campo()?.value).toBe('')
  })

  it('con la edge sin monto: no aparece el campo y el rango abierto avanza solo', async () => {
    montar(EDGE_SIN_MONTO)
    await irAlPrecio('Comprar')
    await clic('Más de USD 700.000')
    expect(await screen.findByRole('heading', { name: '¿Cómo pensás pagar?' })).toBeTruthy()
    expect(campo()).toBeNull()
  })
})

describe('payload con monto', () => {
  const contacto = { nombre: 'Ana', apellido: 'Gómez', telefono: '2235551234', email: '' }
  const compra: Respuestas = {
    operacion: 'COMPRA',
    tipo_propiedad: 'CASA',
    presupuesto: 'USD_700K_MAS',
    presupuesto_monto: 900_000,
    pago: 'CONTADO',
    plazo: 'YA',
    vender: false,
  }
  const enviado = (datos: DatosLink, r: Respuestas) => armarPayload(datos, 't', r, contacto, '').respuestas

  it('se manda si la edge trae monto en el rango', () => {
    expect(enviado(EDGE_ACTUAL, compra).presupuesto_monto).toBe(900_000)
  })

  it('no se manda si la edge no trae monto en el rango', () => {
    const r = enviado(EDGE_SIN_MONTO, compra)
    expect(r.presupuesto).toBe('USD_700K_MAS')
    expect('presupuesto_monto' in r).toBe(false)
  })

  it('no se manda con un rango que no es abierto, ni fuera de los límites', () => {
    expect('presupuesto_monto' in enviado(EDGE_ACTUAL, { ...compra, presupuesto: 'USD_400_700K' })).toBe(false)
    expect('presupuesto_monto' in enviado(EDGE_ACTUAL, { ...compra, presupuesto_monto: 1 })).toBe(false)
  })
})
