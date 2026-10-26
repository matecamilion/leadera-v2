import { describe, expect, it } from 'vitest'
import { conEstado, FILTROS_ESTADO_VALIDOS, leerFiltroEstado, sufijoDelFiltro } from './filtroEstadoLeads'

describe('leerFiltroEstado', () => {
  it('acepta todos los valores conocidos, sin_clasificar incluido', () => {
    for (const valor of FILTROS_ESTADO_VALIDOS) expect(leerFiltroEstado(valor)).toBe(valor)
    expect(leerFiltroEstado('sin_clasificar')).toBe('sin_clasificar')
  })

  it('ignora lo que no conoce', () => {
    expect(leerFiltroEstado(null)).toBeUndefined()
    expect(leerFiltroEstado('')).toBeUndefined()
    expect(leerFiltroEstado('caliente')).toBeUndefined()
    expect(leerFiltroEstado('sin-clasificar')).toBeUndefined()
  })

  it('"nuevos" y "sin_clasificar" son valores distintos', () => {
    expect(leerFiltroEstado('nuevos')).toBe('nuevos')
    expect(leerFiltroEstado('nuevos')).not.toBe(leerFiltroEstado('sin_clasificar'))
  })
})

describe('conEstado', () => {
  it('escribe el estado conservando el resto de los parámetros', () => {
    const resultado = conEstado(new URLSearchParams('q=perez&rol=compradores&mios=0'), 'sin_clasificar')
    expect(resultado.get('estado')).toBe('sin_clasificar')
    expect(resultado.get('q')).toBe('perez')
    expect(resultado.get('rol')).toBe('compradores')
    expect(resultado.get('mios')).toBe('0')
  })

  it('reemplaza un estado anterior', () => {
    expect(conEstado(new URLSearchParams('estado=CALIENTE'), 'sin_clasificar').get('estado')).toBe(
      'sin_clasificar',
    )
  })

  it('undefined quita el parámetro (Todos)', () => {
    const resultado = conEstado(new URLSearchParams('estado=TIBIO&q=a'), undefined)
    expect(resultado.has('estado')).toBe(false)
    expect(resultado.get('q')).toBe('a')
  })

  it('no modifica los parámetros originales', () => {
    const previos = new URLSearchParams('estado=FRIO')
    conEstado(previos, undefined)
    expect(previos.get('estado')).toBe('FRIO')
  })
})

describe('sufijoDelFiltro', () => {
  it('solo sin_clasificar agrega texto al contador', () => {
    expect(sufijoDelFiltro('sin_clasificar')).toBe('sin clasificar')
    expect(sufijoDelFiltro('CALIENTE')).toBeNull()
    expect(sufijoDelFiltro('nuevos')).toBeNull()
    expect(sufijoDelFiltro(undefined)).toBeNull()
  })
})
