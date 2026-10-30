import { describe, expect, it } from 'vitest'
import { repartirAlto } from './alturasEditorial'

const BOOLS = [true, false]

describe('repartirAlto', () => {
  it('con todo presente suma justo 1330', () => {
    const r = repartirAlto({ subtitulo: true, direccion: true, nota: true, pie: true })
    expect(r).toMatchObject({ altoTitular: 156, altoFoto: 488, alturaInferior: 112, total: 1330 })
  })

  it('en ninguna de las 16 combinaciones sobra ni falta alto: siempre 1330', () => {
    for (const subtitulo of BOOLS)
      for (const direccion of BOOLS)
        for (const nota of BOOLS)
          for (const pie of BOOLS) {
            const { total } = repartirAlto({ subtitulo, direccion, nota, pie })
            expect(total).toBe(1330)
          }
  })

  it('lo que falta se reparte: el titular crece hasta su tope y el resto va a la foto', () => {
    const sinNota = repartirAlto({ subtitulo: true, direccion: true, nota: false, pie: true })
    expect(sinNota).toMatchObject({ altoTitular: 180, altoFoto: 526, alturaInferior: 50 })

    const nada = repartirAlto({ subtitulo: false, direccion: false, nota: false, pie: false })
    expect(nada.altoTitular).toBe(180)
    expect(nada.altoFoto).toBe(488 + 56 + 56 + 112 - 24)
  })

  it('una nota sin pie conserva el bloque inferior completo', () => {
    expect(repartirAlto({ subtitulo: true, direccion: true, nota: true, pie: false }).alturaInferior).toBe(112)
  })
})
