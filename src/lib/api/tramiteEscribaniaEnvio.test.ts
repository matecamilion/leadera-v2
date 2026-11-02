import { beforeEach, describe, expect, it, vi } from 'vitest'

// Un cliente de Supabase simulado que recuerda qué se le mandó al upsert.
const envio = vi.hoisted(() => ({
  upsert: undefined as unknown,
  opciones: undefined as unknown,
  tipo: 'VENTA',
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      if (tabla === 'operaciones') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { inmobiliaria_id: 'inmo-1', tipo: envio.tipo },
                  error: null,
                }),
            }),
          }),
        }
      }
      return {
        upsert: (payload: unknown, opciones: unknown) => {
          envio.upsert = payload
          envio.opciones = opciones
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'fila-1' }, error: null }),
            }),
          }
        },
      }
    },
  },
}))

import { guardarDatosEscribania, MENSAJE_TRAMITE_NO_APLICA } from './tramite'

beforeEach(() => {
  envio.upsert = undefined
  envio.opciones = undefined
  envio.tipo = 'VENTA'
})

describe('guardarDatosEscribania: lo que viaja a la base', () => {
  it('manda null (no undefined) en las tres columnas cuando no hay valor', async () => {
    await guardarDatosEscribania('op-1', {
      escribania_nombre: null,
      presupuesto_monto: null,
      presupuesto_moneda: null,
    })

    const cuerpo = envio.upsert as Record<string, unknown>
    expect(cuerpo).toMatchObject({
      inmobiliaria_id: 'inmo-1',
      operacion_id: 'op-1',
      paso: 'ESCRIBANIA_ELEGIDA',
    })
    // `hasOwnProperty` y no `toBeNull` solo: una clave omitida no borra nada.
    for (const columna of ['escribania_nombre', 'presupuesto_monto', 'presupuesto_moneda']) {
      expect(Object.prototype.hasOwnProperty.call(cuerpo, columna)).toBe(true)
      expect(cuerpo[columna]).toBeNull()
    }
    expect(envio.opciones).toEqual({ onConflict: 'operacion_id,paso' })
  })

  it('no completa el paso: no manda fecha_completado ni no_aplica', async () => {
    await guardarDatosEscribania('op-1', {
      escribania_nombre: 'Pérez',
      presupuesto_monto: 1500,
      presupuesto_moneda: 'USD',
    })

    const cuerpo = envio.upsert as Record<string, unknown>
    expect(cuerpo).toMatchObject({
      escribania_nombre: 'Pérez',
      presupuesto_monto: 1500,
      presupuesto_moneda: 'USD',
    })
    expect(cuerpo).not.toHaveProperty('fecha_completado')
    expect(cuerpo).not.toHaveProperty('no_aplica')
  })

  it('un alquiler no lleva trámite: no escribe nada', async () => {
    envio.tipo = 'ALQUILER'
    await expect(
      guardarDatosEscribania('op-1', {
        escribania_nombre: 'X',
        presupuesto_monto: null,
        presupuesto_moneda: null,
      }),
    ).rejects.toThrow(MENSAJE_TRAMITE_NO_APLICA)
    expect(envio.upsert).toBeUndefined()
  })
})
