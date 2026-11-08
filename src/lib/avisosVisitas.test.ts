import { describe, expect, it } from 'vitest'
import {
  decidirAviso,
  fechaEnArgentina,
  fechasDeLectura,
  inicioDeVisita,
  lugarDeVisita,
  MAX_TITULO_AVISO,
  nombreDeLead,
  refDeVisita,
  tagDeAviso,
  textoDeAviso,
  urlDeAviso,
} from '../../supabase/functions/_shared/avisosVisitas.ts'

const AR = (iso: string) => Date.parse(`${iso}-03:00`)
const MIN = 60_000
const ID = '11111111-1111-4111-8111-111111111111'

describe('inicioDeVisita', () => {
  it('lee fecha y hora como hora de Argentina', () => {
    expect(inicioDeVisita('2026-11-08', '15:30:00')).toBe(Date.parse('2026-11-08T18:30:00Z'))
    expect(inicioDeVisita('2026-11-08', '15:30')).toBe(Date.parse('2026-11-08T18:30:00Z'))
  })
})

describe('decidirAviso', () => {
  const inicio = AR('2026-11-08T15:00:00')

  it.each([
    [-61, null],
    [-60, 'VISITA_PROXIMA'],
    [-30, 'VISITA_PROXIMA'],
    [-1, 'VISITA_PROXIMA'],
    [0, null],
    [1, null],
    [29, null],
    [30, 'VISITA_POST'],
    [120, 'VISITA_POST'],
    [180, 'VISITA_POST'],
    [181, null],
  ])('ahora = inicio %i min → %s', (minutos, esperado) => {
    expect(decidirAviso(inicio + minutos * MIN, inicio)).toBe(esperado)
  })

  it('un segundo antes del borde de 60 min todavía no es recordatorio', () => {
    expect(decidirAviso(inicio - 60 * MIN - 1000, inicio)).toBeNull()
    expect(decidirAviso(inicio - 60 * MIN + 1000, inicio)).toBe('VISITA_PROXIMA')
  })

  it('un segundo antes de los 30 min no es post; a los 180 min y un segundo ya no', () => {
    expect(decidirAviso(inicio + 30 * MIN - 1000, inicio)).toBeNull()
    expect(decidirAviso(inicio + 180 * MIN + 1000, inicio)).toBeNull()
  })

  it('una fecha inválida no dispara nada', () => {
    expect(decidirAviso(inicio, inicioDeVisita('xx', '15:00'))).toBeNull()
  })
})

describe('refDeVisita', () => {
  it('un cambio de hora o de día genera otro ref', () => {
    const a = refDeVisita(ID, inicioDeVisita('2026-11-08', '15:00'))
    const b = refDeVisita(ID, inicioDeVisita('2026-11-08', '16:00'))
    const c = refDeVisita(ID, inicioDeVisita('2026-11-09', '15:00'))
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('la misma visita da el mismo ref, con o sin segundos', () => {
    expect(refDeVisita(ID, inicioDeVisita('2026-11-08', '15:00:00'))).toBe(
      refDeVisita(ID, inicioDeVisita('2026-11-08', '15:00')),
    )
  })

  it('es el id, "@" y el instante ISO, y entra en los 200 caracteres de la columna', () => {
    const ref = refDeVisita(ID, inicioDeVisita('2026-11-08', '15:30'))
    expect(ref).toBe(`${ID}@2026-11-08T18:30:00.000Z`)
    expect(ref.length).toBeLessThanOrEqual(200)
  })
})

describe('días de Argentina', () => {
  it('la medianoche de Argentina es a las 03:00 UTC', () => {
    expect(fechaEnArgentina(Date.parse('2026-11-09T02:59:59Z'))).toBe('2026-11-08')
    expect(fechaEnArgentina(Date.parse('2026-11-09T03:00:00Z'))).toBe('2026-11-09')
  })

  it('lee ayer, hoy y mañana', () => {
    expect(fechasDeLectura(AR('2026-11-08T12:00:00'))).toEqual(['2026-11-07', '2026-11-08', '2026-11-09'])
  })

  it('visita a las 00:30: el recordatorio sale a las 23:30 del día anterior y se lee con fecha de mañana', () => {
    const ahora = AR('2026-11-08T23:30:00')
    const inicio = inicioDeVisita('2026-11-09', '00:30')
    expect(fechasDeLectura(ahora)).toContain('2026-11-09')
    expect(decidirAviso(ahora, inicio)).toBe('VISITA_PROXIMA')
  })

  it('visita a las 23:00: el post sale pasada la medianoche y se lee con fecha de ayer', () => {
    const ahora = AR('2026-11-09T00:00:00')
    const inicio = inicioDeVisita('2026-11-08', '23:00')
    expect(fechasDeLectura(ahora)).toContain('2026-11-08')
    expect(decidirAviso(ahora, inicio)).toBe('VISITA_POST')
  })

  it('la fecha del aviso es la de la visita, no la del momento en que sale', () => {
    expect(fechaEnArgentina(inicioDeVisita('2026-11-09', '00:30'))).toBe('2026-11-09')
  })
})

describe('tag y url', () => {
  it('el tag cumple lo que acepta enviar-push', () => {
    for (const tipo of ['VISITA_PROXIMA', 'VISITA_POST'] as const) {
      expect(tagDeAviso(tipo, ID)).toMatch(/^[A-Za-z0-9:_-]{1,64}$/)
    }
    expect(tagDeAviso('VISITA_PROXIMA', ID)).toBe(`visita-proxima-${ID}`)
    expect(tagDeAviso('VISITA_POST', ID)).toBe(`visita-post-${ID}`)
  })

  it('con lead abre la ficha; sin lead, tareas', () => {
    expect(urlDeAviso(ID)).toBe(`/leads/${ID}`)
    expect(urlDeAviso(null)).toBe('/tareas')
  })
})

describe('textos', () => {
  const lead = nombreDeLead({ nombre: 'Ana', apellido: 'Gómez' })

  it('post con nombre y dirección', () => {
    const t = textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00:00', nombre: lead, lugar: 'Güemes 1234' })
    expect(t.title).toBe('¿Cómo te fue con Ana Gómez en Güemes 1234?')
    expect(t.body).toContain('ficha del lead')
  })

  it('recordatorio con nombre, dirección y hora', () => {
    const t = textoDeAviso({ tipo: 'VISITA_PROXIMA', hora: '15:30:00', nombre: lead, lugar: 'Güemes 1234' })
    expect(t.title).toBe('Visita a las 15:30 con Ana Gómez en Güemes 1234')
    expect(t.body).toBe('Empieza a las 15:30. Güemes 1234. Con Ana Gómez.')
  })

  it('visita sin dirección', () => {
    expect(textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00', nombre: lead, lugar: null }).title).toBe(
      '¿Cómo te fue con Ana Gómez?',
    )
    expect(textoDeAviso({ tipo: 'VISITA_PROXIMA', hora: '15:00', nombre: lead, lugar: null }).title).toBe(
      'Visita a las 15:00 con Ana Gómez',
    )
  })

  it('visita externa sin lead: usa el título externo y manda a tareas', () => {
    const lugar = lugarDeVisita(null, ' Tasación Belgrano ')
    const post = textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00', nombre: null, lugar })
    expect(post.title).toBe('¿Cómo te fue en Tasación Belgrano?')
    expect(post.body).toContain('Tareas')
    expect(textoDeAviso({ tipo: 'VISITA_PROXIMA', hora: '15:00', nombre: null, lugar }).body).toBe(
      'Empieza a las 15:00. Tasación Belgrano.',
    )
  })

  it('sin nombre ni dirección', () => {
    expect(textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00', nombre: null, lugar: null }).title).toBe('¿Cómo te fue?')
    expect(textoDeAviso({ tipo: 'VISITA_PROXIMA', hora: '15:00', nombre: null, lugar: null }).title).toBe(
      'Visita a las 15:00',
    )
  })

  it('si no entra, recorta la dirección antes que el nombre', () => {
    const lugar = 'Avenida Libertador General San Martín 12345, piso 8 departamento B'
    const t = textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00', nombre: lead, lugar })
    expect(t.title.length).toBeLessThanOrEqual(MAX_TITULO_AVISO)
    expect(t.title).toContain('con Ana Gómez en Avenida')
    expect(t.title.endsWith('…?')).toBe(true)
  })

  it('con un nombre larguísimo la dirección queda en su mínimo y se recorta el nombre', () => {
    const nombre = 'Juan Carlos Alberto Fernández de la Vega y Santa María Ortiz'
    const t = textoDeAviso({ tipo: 'VISITA_POST', hora: '15:00', nombre, lugar: 'Güemes 1234' })
    expect(t.title.length).toBeLessThanOrEqual(MAX_TITULO_AVISO)
    expect(t.title).toContain('con Juan Carlos')
    expect(t.title).toContain(' en Güemes')
    expect(t.title).not.toContain('Ortiz')
  })

  it('el cuerpo del recordatorio nunca pasa de 120 caracteres', () => {
    const t = textoDeAviso({ tipo: 'VISITA_PROXIMA', hora: '15:00', nombre: lead, lugar: 'x '.repeat(100) })
    expect(t.body.length).toBeLessThanOrEqual(120)
  })
})

describe('nombreDeLead y lugarDeVisita', () => {
  it('arma el nombre completo, sin apellido o sin lead', () => {
    expect(nombreDeLead({ nombre: 'Ana', apellido: null })).toBe('Ana')
    expect(nombreDeLead({ nombre: ' Ana ', apellido: ' Gómez ' })).toBe('Ana Gómez')
    expect(nombreDeLead(null)).toBeNull()
  })

  it('prefiere la dirección de la propiedad y trata el blanco como ausente', () => {
    expect(lugarDeVisita('Güemes 1234', 'otro')).toBe('Güemes 1234')
    expect(lugarDeVisita('  ', null)).toBeNull()
  })
})
