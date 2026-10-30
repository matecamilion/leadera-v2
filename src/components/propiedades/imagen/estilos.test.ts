import { describe, expect, it } from 'vitest'
import {
  agregarEstilo,
  alternarPredeterminado,
  borrarEstilo,
  eleccionDeEstilo,
  estiloPredeterminado,
  leerEstilos,
  limpiarNombre,
  MAX_ESTILOS,
  plantillaParaEstilo,
  renombrarEstilo,
  serializarEstilos,
  type ContenidoEstilo,
} from './estilos'

const CONTENIDO: ContenidoEstilo = {
  plantilla: 'editorial',
  paleta: 'dorado',
  encabezado: 'Inmobiliaria Sur',
  agente: 'Ana Pérez',
  firma: '@anaperez',
  conDireccion: true,
}

const PERSONALIZADO: ContenidoEstilo = {
  ...CONTENIDO,
  paleta: 'personalizada',
  primario: '#e63946',
  secundario: '#f1faee',
}

function listaDe(n: number) {
  let lista = [] as ReturnType<typeof leerEstilos>
  for (let i = 0; i < n; i++) lista = agregarEstilo(lista, `id${i}`, `Estilo ${i}`, CONTENIDO) ?? lista
  return lista
}

describe('serialización y lectura', () => {
  it('lo que se guarda se lee igual', () => {
    const lista = agregarEstilo([], 'a', 'Mi marca', PERSONALIZADO)!
    expect(leerEstilos(serializarEstilos(lista))).toEqual(lista)
  })

  it('guarda la versión', () => {
    expect(JSON.parse(serializarEstilos([])).version).toBe(1)
  })

  it('sin texto, con JSON roto o de otra forma da lista vacía', () => {
    for (const malo of [null, '', '{roto', '"hola"', 'null', '[]', '{"version":1}', '{"version":1,"estilos":{}}']) {
      expect(leerEstilos(malo)).toEqual([])
    }
  })

  it('otra versión se ignora', () => {
    const lista = agregarEstilo([], 'a', 'Mi marca', CONTENIDO)!
    const v2 = JSON.stringify({ version: 2, estilos: lista })
    expect(leerEstilos(v2)).toEqual([])
  })

  it('una entrada rota se descarta y las demás sobreviven', () => {
    const buena = agregarEstilo([], 'a', 'Buena', CONTENIDO)![0]
    const texto = JSON.stringify({
      version: 1,
      estilos: [
        { ...buena, id: 'x', paleta: 'inexistente' },
        { ...buena, id: 'y', conDireccion: 'si' },
        { ...buena, id: 'z', paleta: 'personalizada', primario: '#12', secundario: '#ffffff' },
        null,
        buena,
      ],
    })
    expect(leerEstilos(texto)).toEqual([buena])
  })

  it('no pasa de seis ni repite ids', () => {
    const lista = listaDe(MAX_ESTILOS)
    const texto = JSON.stringify({ version: 1, estilos: [...lista, ...lista, { ...lista[0], id: 'otro' }] })
    expect(leerEstilos(texto)).toHaveLength(MAX_ESTILOS)
  })

  it('si vienen varios predeterminados, queda el primero', () => {
    const lista = listaDe(3).map((e) => ({ ...e, predeterminado: true }))
    const leida = leerEstilos(serializarEstilos(lista))
    expect(leida.map((e) => e.predeterminado)).toEqual([true, false, false])
  })
})

describe('límite de seis', () => {
  it('deja guardar hasta seis y rechaza el séptimo', () => {
    const seis = listaDe(MAX_ESTILOS)
    expect(seis).toHaveLength(MAX_ESTILOS)
    expect(agregarEstilo(seis, 'extra', 'Otro', CONTENIDO)).toBeNull()
  })

  it('rechaza un nombre vacío', () => {
    expect(agregarEstilo([], 'a', '   ', CONTENIDO)).toBeNull()
  })

  it('limpia el nombre', () => {
    expect(limpiarNombre('  Mi   marca  ')).toBe('Mi marca')
    expect(limpiarNombre('')).toBeNull()
  })
})

describe('predeterminado, renombrar y borrar', () => {
  it('hay un solo predeterminado', () => {
    let lista = listaDe(3)
    lista = alternarPredeterminado(lista, 'id0')
    lista = alternarPredeterminado(lista, 'id2')
    expect(lista.filter((e) => e.predeterminado).map((e) => e.id)).toEqual(['id2'])
    expect(estiloPredeterminado(lista)?.id).toBe('id2')
  })

  it('volver a tocar el predeterminado lo desmarca', () => {
    const lista = alternarPredeterminado(alternarPredeterminado(listaDe(2), 'id1'), 'id1')
    expect(estiloPredeterminado(lista)).toBeUndefined()
  })

  it('renombra sólo el elegido y no acepta un nombre vacío', () => {
    const lista = listaDe(2)
    expect(renombrarEstilo(lista, 'id1', ' Nuevo ').map((e) => e.nombre)).toEqual(['Estilo 0', 'Nuevo'])
    expect(renombrarEstilo(lista, 'id1', '  ')).toBe(lista)
  })

  it('borra y libera el lugar', () => {
    const sin = borrarEstilo(listaDe(MAX_ESTILOS), 'id3')
    expect(sin.map((e) => e.id)).not.toContain('id3')
    expect(agregarEstilo(sin, 'nuevo', 'Nuevo', CONTENIDO)).toHaveLength(MAX_ESTILOS)
  })

  it('borrar el predeterminado deja la lista sin predeterminado', () => {
    const lista = borrarEstilo(alternarPredeterminado(listaDe(2), 'id0'), 'id0')
    expect(estiloPredeterminado(lista)).toBeUndefined()
  })
})

describe('aplicar un estilo', () => {
  it('un atajo vuelve a los selectores con su acento y fondo', () => {
    const [e] = agregarEstilo([], 'a', 'Marca', CONTENIDO)!
    expect(eleccionDeEstilo(e)).toEqual({ clave: 'dorado', primario: '#ad8420', secundario: '#faf5e6' })
  })

  it('una paleta personalizada vuelve con sus dos colores', () => {
    const [e] = agregarEstilo([], 'a', 'Marca', PERSONALIZADO)!
    expect(eleccionDeEstilo(e)).toEqual({
      clave: 'personalizada',
      primario: '#e63946',
      secundario: '#f1faee',
    })
  })

  const PLANTILLAS = [
    { id: 'editorial', nombre: 'Editorial', fotos: 5 },
    { id: 'impacto', nombre: 'Impacto', fotos: 3 },
  ]

  it('aplica la plantilla si alcanzan las fotos', () => {
    const [e] = agregarEstilo([], 'a', 'Marca', CONTENIDO)!
    expect(plantillaParaEstilo(e, PLANTILLAS, 5)).toEqual({ plantillaId: 'editorial', aviso: null })
  })

  it('si no alcanzan las fotos no la cambia y avisa por qué', () => {
    const [e] = agregarEstilo([], 'a', 'Marca', CONTENIDO)!
    const r = plantillaParaEstilo(e, PLANTILLAS, 3)
    expect(r.plantillaId).toBeNull()
    expect(r.aviso).toMatch(/Editorial.*5 fotos.*tiene 3/)
  })

  it('si la plantilla ya no existe no la cambia y avisa', () => {
    const [e] = agregarEstilo([], 'a', 'Marca', { ...CONTENIDO, plantilla: 'vieja' })!
    expect(plantillaParaEstilo(e, PLANTILLAS, 9)).toMatchObject({ plantillaId: null })
  })
})
