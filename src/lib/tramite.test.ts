import { describe, expect, it } from 'vitest'
import {
  escrituraHecha,
  fechaInicialEscritura,
  formatearDiaMes,
  PASOS_TRAMITE,
  pasosFaltantes,
  pasosResueltos,
  siguientePaso,
  textoEstadoTramite,
  type FilaPasoTramite,
} from './tramite'

function hecho(paso: string, fecha = '2026-10-30'): FilaPasoTramite {
  return { paso, fecha_completado: fecha, no_aplica: false }
}

function noAplica(paso: string): FilaPasoTramite {
  return { paso, fecha_completado: null, no_aplica: true }
}

function sinCompletar(paso: string): FilaPasoTramite {
  return { paso, fecha_completado: null, no_aplica: false }
}

describe('PASOS_TRAMITE', () => {
  it('son seis, en el orden del trámite, sin claves repetidas', () => {
    expect(PASOS_TRAMITE.map((p) => p.clave)).toEqual([
      'PRESUPUESTOS_PEDIDOS',
      'ESCRIBANIA_ELEGIDA',
      'DOCUMENTACION_ENVIADA',
      'CERTIFICADOS_PEDIDOS',
      'CERTIFICADOS_RECIBIDOS',
      'ESCRITURA',
    ])
  })
})

describe('sin filas', () => {
  it('no hay nada resuelto y falta todo', () => {
    expect(pasosResueltos([])).toBe(0)
    expect(pasosFaltantes([])).toHaveLength(6)
    expect(siguientePaso([])).toBe('PRESUPUESTOS_PEDIDOS')
    expect(escrituraHecha([])).toBe(false)
  })
})

describe('pasosResueltos y pasosFaltantes', () => {
  it('cuentan igual un paso completado que uno que no aplica', () => {
    const filas = [hecho('PRESUPUESTOS_PEDIDOS'), noAplica('ESCRIBANIA_ELEGIDA')]
    expect(pasosResueltos(filas)).toBe(2)
    expect(pasosFaltantes(filas)).toEqual([
      'DOCUMENTACION_ENVIADA',
      'CERTIFICADOS_PEDIDOS',
      'CERTIFICADOS_RECIBIDOS',
      'ESCRITURA',
    ])
  })

  it('una fila desmarcada (sin fecha y sin "no aplica") sigue faltando', () => {
    const filas = [sinCompletar('PRESUPUESTOS_PEDIDOS')]
    expect(pasosResueltos(filas)).toBe(0)
    expect(pasosFaltantes(filas)[0]).toBe('PRESUPUESTOS_PEDIDOS')
  })

  it('los faltantes salen en el orden del trámite, no en el de las filas', () => {
    const filas = [hecho('ESCRITURA'), hecho('ESCRIBANIA_ELEGIDA')]
    expect(pasosFaltantes(filas)).toEqual([
      'PRESUPUESTOS_PEDIDOS',
      'DOCUMENTACION_ENVIADA',
      'CERTIFICADOS_PEDIDOS',
      'CERTIFICADOS_RECIBIDOS',
    ])
  })

  it('ignora una fila de un paso que no existe', () => {
    expect(pasosResueltos([hecho('OTRO_PASO')])).toBe(0)
  })

  it('con todo resuelto no falta nada', () => {
    const filas = PASOS_TRAMITE.map((p) => hecho(p.clave))
    expect(pasosResueltos(filas)).toBe(6)
    expect(pasosFaltantes(filas)).toEqual([])
  })
})

describe('siguientePaso', () => {
  it('es el primero sin resolver, aunque haya resueltos más adelante', () => {
    const filas = [hecho('PRESUPUESTOS_PEDIDOS'), hecho('DOCUMENTACION_ENVIADA')]
    expect(siguientePaso(filas)).toBe('ESCRIBANIA_ELEGIDA')
  })

  it('es null cuando no queda ninguno', () => {
    const filas = PASOS_TRAMITE.map((p) => noAplica(p.clave))
    expect(siguientePaso(filas)).toBeNull()
  })
})

describe('escrituraHecha', () => {
  it('es true con la escritura completada', () => {
    expect(escrituraHecha([hecho('ESCRITURA')])).toBe(true)
  })

  it('es false si la escritura se marcó como "no aplica"', () => {
    expect(escrituraHecha([noAplica('ESCRITURA')])).toBe(false)
  })

  it('es false si la escritura se desmarcó', () => {
    expect(escrituraHecha([sinCompletar('ESCRITURA')])).toBe(false)
  })

  it('no la deduce de los otros pasos', () => {
    const filas = PASOS_TRAMITE.filter((p) => p.clave !== 'ESCRITURA').map((p) => hecho(p.clave))
    expect(escrituraHecha(filas)).toBe(false)
  })
})

describe('formatearDiaMes', () => {
  it('da DD/MM sin correr el día por la zona horaria', () => {
    expect(formatearDiaMes('2026-11-05')).toBe('05/11')
    expect(formatearDiaMes('2026-01-31')).toBe('31/01')
  })
})

describe('textoEstadoTramite', () => {
  it('sin nada hecho, apunta al primer paso', () => {
    expect(textoEstadoTramite([])).toBe('Siguiente: Presupuestos de escribanías pedidos')
  })

  it('apunta al primer paso sin resolver', () => {
    const filas = [hecho('PRESUPUESTOS_PEDIDOS'), noAplica('ESCRIBANIA_ELEGIDA')]
    expect(textoEstadoTramite(filas)).toBe('Siguiente: Documentación enviada a la escribanía')
  })

  it('con la escritura hecha, dice cuándo', () => {
    expect(textoEstadoTramite([hecho('ESCRITURA', '2026-12-09')])).toBe(
      'Escritura realizada el 09/12',
    )
  })

  it('con todo resuelto pero la escritura en "no aplica", está completo', () => {
    const filas = PASOS_TRAMITE.map((p) => noAplica(p.clave))
    expect(textoEstadoTramite(filas)).toBe('Trámite completo')
  })
})

describe('fechaInicialEscritura', () => {
  it('usa la prevista si es de hoy o anterior', () => {
    expect(fechaInicialEscritura('2026-11-05', '2026-11-10')).toBe('2026-11-05')
    expect(fechaInicialEscritura('2026-11-10', '2026-11-10')).toBe('2026-11-10')
  })

  it('usa hoy si la prevista es futura', () => {
    expect(fechaInicialEscritura('2026-11-20', '2026-11-10')).toBe('2026-11-10')
  })

  it('usa hoy si no hay prevista', () => {
    expect(fechaInicialEscritura(null, '2026-11-10')).toBe('2026-11-10')
  })
})
