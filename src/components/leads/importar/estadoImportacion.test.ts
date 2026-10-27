import { describe, expect, it, vi } from 'vitest'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import { entradaSegunCupo } from './cupoImportacion'
import { INICIAL, reducir, type Estado } from './estadoImportacion'
import { conTelefono, revisionDe } from './utilesDePrueba'

vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

const ARCHIVO: ArchivoLeido = {
  hoja: null,
  encabezados: ['Nombre y apellido', 'Celular'],
  filas: [{ numeroFilaOriginal: 2, celdas: { 0: 'Ana Gómez', 1: '223 555-0101' } }],
}

const REVISION = revisionDe({ filas: [conTelefono(2), conTelefono(3)] })

function conArchivo(): Estado {
  return reducir(INICIAL, { tipo: 'cargado', nombre: 'leads.xlsx', archivo: ARCHIVO })
}
function enRevision(): Estado {
  let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
  e = reducir(e, { tipo: 'verificando' })
  return reducir(e, { tipo: 'verificado', revision: REVISION })
}

describe('reducer: archivo y columnas', () => {
  it('un archivo cargado arranca en el paso 1 con la propuesta de columnas', () => {
    const e = conArchivo()
    expect(e.paso).toBe(1)
    expect(e.mapeo).toEqual({ nombreCompleto: 0, telefono: 1 })
    expect(e.nombreArchivo).toBe('leads.xlsx')
  })

  it('un fallo de lectura no pisa el archivo ya cargado', () => {
    const e = reducir(conArchivo(), { tipo: 'fallo', mensaje: 'pesa mucho' })
    expect(e.error).toBe('pesa mucho')
    expect(e.archivo).toBe(ARCHIVO)
  })

  it('cambiar el mapeo borra un error de verificación anterior', () => {
    let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
    e = reducir(e, { tipo: 'verificando' })
    e = reducir(e, { tipo: 'fallaVerificacion', mensaje: 'sin red' })
    e = reducir(e, { tipo: 'mapear', mapeo: { nombre: 0 } })
    expect(e.errorVerificacion).toBeNull()
  })
})

describe('reducer: paso 2 -> 3', () => {
  it('verificando bloquea y verificado avanza al paso 3 con la revisión', () => {
    let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
    e = reducir(e, { tipo: 'verificando' })
    expect(e.verificando).toBe(true)
    expect(e.paso).toBe(2)

    e = reducir(e, { tipo: 'verificado', revision: REVISION })
    expect(e.paso).toBe(3)
    expect(e.verificando).toBe(false)
    expect(e.revision).toBe(REVISION)
  })

  it('si falla, se queda en el paso 2 con el mensaje: nunca avanza sin respuesta', () => {
    let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
    e = reducir(e, { tipo: 'verificando' })
    e = reducir(e, { tipo: 'fallaVerificacion', mensaje: 'Sesión inválida o expirada' })

    expect(e.paso).toBe(2)
    expect(e.verificando).toBe(false)
    expect(e.errorVerificacion).toBe('Sesión inválida o expirada')
    expect(e.revision).toBeNull()
  })

  it('reintentar limpia el error', () => {
    let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
    e = reducir(e, { tipo: 'verificando' })
    e = reducir(e, { tipo: 'fallaVerificacion', mensaje: 'x' })
    e = reducir(e, { tipo: 'verificando' })
    expect(e.errorVerificacion).toBeNull()
    expect(e.verificando).toBe(true)
  })

  it('una respuesta que llega tras reiniciar se descarta', () => {
    let e = reducir(conArchivo(), { tipo: 'paso', paso: 2 })
    e = reducir(e, { tipo: 'verificando' })
    e = reducir(e, { tipo: 'reiniciar' })
    e = reducir(e, { tipo: 'verificado', revision: REVISION })
    expect(e).toEqual(INICIAL)
  })
})

describe('reducer: volver y confirmar', () => {
  it('volver del 3 al 2 conserva el mapeo y descarta la revisión', () => {
    let e = enRevision()
    e = { ...e, mapeo: { nombre: 0, telefono: 1 } }
    e = reducir(e, { tipo: 'paso', paso: 2 })

    expect(e.paso).toBe(2)
    expect(e.mapeo).toEqual({ nombre: 0, telefono: 1 })
    expect(e.revision).toBeNull()
  })

  it('importar pasa al 4 con el progreso en cero', () => {
    const e = reducir(enRevision(), { tipo: 'importar', total: 450 })
    expect(e.paso).toBe(4)
    expect(e.importando).toBe(true)
    expect(e.progreso).toEqual({ procesadas: 0, total: 450 })
  })

  it('importar dos veces no reinicia nada', () => {
    const una = reducir(enRevision(), { tipo: 'importar', total: 450 })
    const avanzada = reducir(una, { tipo: 'progreso', procesadas: 200, total: 450 })
    expect(reducir(avanzada, { tipo: 'importar', total: 450 })).toBe(avanzada)
  })

  it('importar solo se acepta desde el paso 3', () => {
    const e = conArchivo()
    expect(reducir(e, { tipo: 'importar', total: 5 })).toBe(e)
  })

  it('el progreso se actualiza mientras se importa', () => {
    let e = reducir(enRevision(), { tipo: 'importar', total: 450 })
    e = reducir(e, { tipo: 'progreso', procesadas: 200, total: 450 })
    expect(e.progreso).toEqual({ procesadas: 200, total: 450 })
  })

  it('terminado guarda el resultado y apaga importando', () => {
    let e = reducir(enRevision(), { tipo: 'importar', total: 2 })
    const resultado = { insertados: 2, resultados: [], corte: null }
    e = reducir(e, { tipo: 'terminado', resultado })
    expect(e.importando).toBe(false)
    expect(e.resultado).toBe(resultado)
    expect(e.paso).toBe(4)
  })

  it('desde el paso 4 no se puede volver (reimportar duplicaría)', () => {
    let e = reducir(enRevision(), { tipo: 'importar', total: 2 })
    e = reducir(e, { tipo: 'terminado', resultado: { insertados: 2, resultados: [], corte: null } })
    expect(reducir(e, { tipo: 'paso', paso: 2 })).toBe(e)
    expect(reducir(e, { tipo: 'paso', paso: 1 })).toBe(e)
  })

  it('"importar otro archivo" resetea todo', () => {
    let e = reducir(enRevision(), { tipo: 'importar', total: 2 })
    e = reducir(e, { tipo: 'terminado', resultado: { insertados: 2, resultados: [], corte: null } })
    expect(reducir(e, { tipo: 'reiniciar' })).toEqual(INICIAL)
  })
})

describe('entradaSegunCupo', () => {
  it('sin tope entra todo', () => {
    expect(entradaSegunCupo(500, { limite: null, usados: 9999 })).toEqual({
      entran: 500,
      quedanAfuera: 0,
      lugares: null,
      agotado: false,
    })
  })

  it('con lugar de sobra', () => {
    expect(entradaSegunCupo(30, { limite: 200, usados: 100 })).toMatchObject({ entran: 30, quedanAfuera: 0, lugares: 100 })
  })

  it('justo', () => {
    expect(entradaSegunCupo(100, { limite: 200, usados: 100 })).toMatchObject({ entran: 100, quedanAfuera: 0, agotado: false })
  })

  it('no alcanza: entran los primeros que caben', () => {
    expect(entradaSegunCupo(150, { limite: 200, usados: 180 })).toEqual({
      entran: 20,
      quedanAfuera: 130,
      lugares: 20,
      agotado: false,
    })
  })

  it('agotado, incluso si ya hay más usados que el límite', () => {
    expect(entradaSegunCupo(10, { limite: 200, usados: 200 })).toMatchObject({ entran: 0, quedanAfuera: 10, agotado: true })
    expect(entradaSegunCupo(10, { limite: 200, usados: 230 })).toMatchObject({ entran: 0, lugares: 0, agotado: true })
  })
})
