import { describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Sin sesión, `crearReserva` corta en la primera lectura: alcanza para ver
// si el monto la frenó antes.
vi.mock('../supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) }, rpc, from },
}))

import {
  aplicarCambioDeEstado,
  cerrarOperacionGanada,
  crearReserva,
  listarOperaciones,
  limitesDelMes,
  llevaEscritura,
  MENSAJE_MONTO_RESERVA,
  puntaDeTipo,
  seMuestraTramite,
  tipoDeReserva,
  type CrearReservaInput,
} from './operaciones'

describe('tipoDeReserva', () => {
  it('vendedora + venta es VENTA', () => {
    expect(tipoDeReserva('vendedora', 'venta')).toBe('VENTA')
  })

  it('vendedora + alquiler es ALQUILER', () => {
    expect(tipoDeReserva('vendedora', 'alquiler')).toBe('ALQUILER')
  })

  it('compradora + venta es COMPRA', () => {
    expect(tipoDeReserva('compradora', 'venta')).toBe('COMPRA')
  })

  it('compradora + alquiler es BUSQUEDA_ALQUILER', () => {
    expect(tipoDeReserva('compradora', 'alquiler')).toBe('BUSQUEDA_ALQUILER')
  })
})

describe('puntaDeTipo', () => {
  it('VENTA y ALQUILER son punta vendedora', () => {
    expect(puntaDeTipo('VENTA')).toBe('vendedora')
    expect(puntaDeTipo('ALQUILER')).toBe('vendedora')
  })

  it('COMPRA y BUSQUEDA_ALQUILER son punta compradora', () => {
    expect(puntaDeTipo('COMPRA')).toBe('compradora')
    expect(puntaDeTipo('BUSQUEDA_ALQUILER')).toBe('compradora')
  })

  it('es la inversa de tipoDeReserva', () => {
    for (const punta of ['vendedora', 'compradora'] as const) {
      for (const clase of ['venta', 'alquiler'] as const) {
        expect(puntaDeTipo(tipoDeReserva(punta, clase))).toBe(punta)
      }
    }
  })
})

describe('llevaEscritura', () => {
  it('la compraventa pasa por escribanía, en las dos puntas', () => {
    expect(llevaEscritura('VENTA')).toBe(true)
    expect(llevaEscritura('COMPRA')).toBe(true)
  })

  it('el alquiler no', () => {
    expect(llevaEscritura('ALQUILER')).toBe(false)
    expect(llevaEscritura('BUSQUEDA_ALQUILER')).toBe(false)
  })
})

describe('seMuestraTramite', () => {
  it('hay trámite desde la reserva y después del cierre', () => {
    expect(seMuestraTramite('VENTA', 'RESERVADA')).toBe(true)
    expect(seMuestraTramite('COMPRA', 'CERRADA_GANADA')).toBe(true)
  })

  it('no hay antes de reservar ni cuando se cancela', () => {
    expect(seMuestraTramite('VENTA', 'PUBLICADA')).toBe(false)
    expect(seMuestraTramite('VENTA', 'EN_NEGOCIACION')).toBe(false)
    expect(seMuestraTramite('COMPRA', 'CANCELADA')).toBe(false)
  })

  it('no hay en el alquiler, cualquiera sea el estado', () => {
    expect(seMuestraTramite('ALQUILER', 'RESERVADA')).toBe(false)
    expect(seMuestraTramite('BUSQUEDA_ALQUILER', 'CERRADA_GANADA')).toBe(false)
  })
})

describe('limitesDelMes', () => {
  it('acepta el primer día de un mes (YYYY-MM-01), como lo arma la vista de reservas', () => {
    expect(limitesDelMes('2026-12-01')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' })
    expect(limitesDelMes('2027-01-01')).toEqual({ desde: '2027-01-01', hasta: '2027-02-01' })
  })

  it('va del primer día del mes al primero del siguiente', () => {
    expect(limitesDelMes('2026-10-28')).toEqual({ desde: '2026-10-01', hasta: '2026-11-01' })
  })

  it('el primer y el último día del mes caen en el mismo mes', () => {
    const esperado = { desde: '2026-10-01', hasta: '2026-11-01' }
    expect(limitesDelMes('2026-10-01')).toEqual(esperado)
    expect(limitesDelMes('2026-10-31')).toEqual(esperado)
  })

  it('diciembre termina en enero del año siguiente', () => {
    expect(limitesDelMes('2026-12-15')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' })
  })

  it('enero arranca en el 1 de enero y termina en febrero', () => {
    expect(limitesDelMes('2027-01-03')).toEqual({ desde: '2027-01-01', hasta: '2027-02-01' })
  })

  it('el cambio de mes cambia el rango', () => {
    expect(limitesDelMes('2026-11-01').desde).toBe('2026-11-01')
    expect(limitesDelMes('2026-10-31').desde).toBe('2026-10-01')
  })
})

describe('crearReserva: monto obligatorio', () => {
  const base: CrearReservaInput = {
    punta: 'vendedora',
    operacion: 'venta',
    titulo: 'Alvear 1890',
    fecha: '2026-10-28',
    monto: 100000,
  }

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['0', 0],
    ['negativo', -5],
    ['menor a 1', 0.5],
    ['NaN', Number.NaN],
    ['un texto', '100'],
  ])('rechaza un monto %s', async (_nombre, monto) => {
    await expect(
      crearReserva({ ...base, monto: monto as unknown as number }),
    ).rejects.toThrow(MENSAJE_MONTO_RESERVA)
  })

  it('con monto 1 pasa la validación y sigue con la sesión', async () => {
    await expect(crearReserva({ ...base, monto: 1 })).rejects.toThrow('Tu sesión expiró')
  })
})

describe('cerrarOperacionGanada', () => {
  const ID = '11111111-1111-4111-8111-111111111111'

  it('llama al RPC con la operación y el valor de cierre, y devuelve la fila', async () => {
    const fila = { id: ID, estado: 'CERRADA_GANADA', monto: 150, monto_cierre: 140 }
    rpc.mockResolvedValueOnce({ data: fila, error: null })

    await expect(cerrarOperacionGanada(ID, 140)).resolves.toBe(fila)
    expect(rpc).toHaveBeenCalledWith('cerrar_operacion_ganada', {
      p_operacion_id: ID,
      p_monto_cierre: 140,
    })
  })

  it('propaga tal cual el mensaje en español del RPC (P0001)', async () => {
    const mensaje = 'No se pudo cerrar la operación: no existe, ya está cerrada o no tenés permiso.'
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: mensaje } })

    await expect(cerrarOperacionGanada(ID, 140)).rejects.toThrow(mensaje)
  })

  it('el rechazo por rango también llega sin traducir', async () => {
    const mensaje = 'El valor de cierre tiene que estar entre 1 y 10.000.000.'
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: mensaje } })

    await expect(cerrarOperacionGanada(ID, 0)).rejects.toThrow(mensaje)
  })

  it('un error que no es nuestro no muestra el volcado del motor', async () => {
    const crudo = 'permission denied for table operaciones'
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: crudo } })

    await expect(cerrarOperacionGanada(ID, 140)).rejects.not.toThrow(crudo)
  })
})

describe('aplicarCambioDeEstado', () => {
  const ID = '11111111-1111-4111-8111-111111111111'

  it('cerrar como ganada va por el RPC y no toca la tabla', async () => {
    rpc.mockClear()
    from.mockClear()
    rpc.mockResolvedValueOnce({ data: { id: ID }, error: null })

    await aplicarCambioDeEstado(ID, { estado: 'CERRADA_GANADA', montoCierre: 140 })

    expect(rpc).toHaveBeenCalledWith('cerrar_operacion_ganada', { p_operacion_id: ID, p_monto_cierre: 140 })
    expect(from).not.toHaveBeenCalled()
  })

  it('cualquier otro estado es un update simple del estado, sin RPC', async () => {
    rpc.mockClear()
    const update = vi.fn().mockReturnValue({
      eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: ID }, error: null }) }) }),
    })
    from.mockReturnValueOnce({ update })

    await aplicarCambioDeEstado(ID, { estado: 'CANCELADA' })

    expect(update).toHaveBeenCalledWith({ estado: 'CANCELADA' })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('listarOperaciones', () => {
  it('completa monto_cierre de las cerradas desde la tabla, porque la vista no lo expone', async () => {
    const filas = [
      { id: 'a', estado: 'CERRADA_GANADA' },
      { id: 'b', estado: 'PUBLICADA' },
    ]
    from.mockReturnValueOnce({
      select: () => ({
        order: () => ({ order: () => ({ range: async () => ({ data: filas, error: null, count: 2 }) }) }),
      }),
    })
    const in_ = vi.fn().mockResolvedValue({ data: [{ id: 'a', monto_cierre: 140 }], error: null })
    from.mockReturnValueOnce({ select: () => ({ in: in_ }) })

    const { data } = await listarOperaciones({ page: 1, pageSize: 10 })

    expect(in_).toHaveBeenCalledWith('id', ['a'])
    expect(data.map((o) => [o.id, o.monto_cierre])).toEqual([
      ['a', 140],
      ['b', null],
    ])
  })
})
