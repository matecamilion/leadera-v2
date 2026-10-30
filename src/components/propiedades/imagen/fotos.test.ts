import { describe, expect, it } from 'vitest'
import { fotosParaPlantilla } from './fotos'

const TODAS = ['a', 'b', 'c', 'd', 'e', 'f']

describe('fotosParaPlantilla', () => {
  it('conserva las elegidas en su orden y completa con las primeras que faltan', () => {
    expect(fotosParaPlantilla(['c', 'a'], TODAS, 5)).toEqual(['c', 'a', 'b', 'd', 'e'])
  })

  it('si piden menos, se queda con las primeras elegidas', () => {
    expect(fotosParaPlantilla(['c', 'a', 'e', 'b', 'd'], TODAS, 3)).toEqual(['c', 'a', 'e'])
  })

  it('con menos fotos de las que pide, devuelve las que hay', () => {
    expect(fotosParaPlantilla(['a'], ['a', 'b'], 5)).toEqual(['a', 'b'])
  })
})
