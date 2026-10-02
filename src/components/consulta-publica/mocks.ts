/**
 * SOLO DESARROLLO. Respuestas falsas para ver cada pantalla con `?mock=`.
 *
 * `api.ts` lo importa con `import()` adentro de `import.meta.env.DEV`: en el
 * build de producción esa rama se elimina y este módulo no se empaqueta.
 *
 *   ?mock=general    link general
 *   ?mock=propiedad  propiedad con fotos
 *   ?mock=sinfotos   propiedad sin fotos
 *   ?mock=nodisp     propiedad que ya no está disponible
 *   ?mock=404        link no disponible
 *   ?mock=500        el envío falla (error con reintento)
 *   ?mock=token      el primer envío vuelve con token vencido; el segundo anda
 */
import {
  OPERACIONES,
  RANGOS_PRESUPUESTO,
} from '../../../supabase/functions/consulta-publica/encuesta.ts'
import type { ResultadoGet, ResultadoPost } from './api'
import type { DatosLink, PayloadConsulta } from './tipos'

const BASE: Omit<DatosLink, 'propiedad' | 'flujo' | 'operacion_fija' | 'link'> = {
  token: 'mockslug0001.0000000000000.firma',
  asesor: { nombre: 'Lucía', apellido: 'Fernández' },
  inmobiliaria: { nombre: 'Costa Propiedades' },
  // Los mismos que arma la edge function, sin min/max.
  rangos_presupuesto: Object.fromEntries(
    OPERACIONES.map((op) => [
      op,
      RANGOS_PRESUPUESTO[op].map(({ codigo, label, moneda }) => ({ codigo, label, moneda })),
    ]),
  ) as DatosLink['rangos_presupuesto'],
}

const PROPIEDAD = {
  disponible: true as const,
  tipo: 'DEPARTAMENTO' as const,
  finalidad: 'VENTA' as const,
  zona: 'Centro',
  precio: 125000,
  moneda: 'USD',
  ambientes: 3,
  metros_cuadrados: 68,
  fotos_urls: [
    'https://picsum.photos/seed/leadera-depto-centro/1200/800',
    'https://picsum.photos/seed/leadera-depto-centro-2/1200/800',
    'https://picsum.photos/seed/leadera-depto-centro-3/1200/800',
  ],
}

function datos(caso: string): DatosLink {
  const general = { slug: 'mockslug0001', tipo: 'GENERAL' as const, preguntas_off: [] }
  const deProp = { slug: 'mockslug0001', tipo: 'PROPIEDAD' as const, preguntas_off: [] }

  switch (caso) {
    case 'propiedad':
    case 'token':
    case '500':
      return { ...BASE, link: deProp, flujo: 'PROPIEDAD', operacion_fija: 'COMPRA', propiedad: PROPIEDAD }
    case 'sinfotos':
      return {
        ...BASE,
        link: deProp,
        flujo: 'PROPIEDAD',
        operacion_fija: 'COMPRA',
        propiedad: { ...PROPIEDAD, fotos_urls: [] },
      }
    case 'nodisp':
      return { ...BASE, link: deProp, flujo: 'GENERAL', operacion_fija: null, propiedad: { disponible: false } }
    default:
      return { ...BASE, link: general, flujo: 'GENERAL', operacion_fija: null, propiedad: null }
  }
}

export async function mockGet(caso: string): Promise<ResultadoGet> {
  await new Promise((r) => setTimeout(r, 400))
  if (caso === '404') return { tipo: 'no_disponible' }
  return { tipo: 'ok', datos: datos(caso), recibidoEn: performance.now() }
}

let enviosToken = 0

export async function mockPost(caso: string, payload: PayloadConsulta): Promise<ResultadoPost> {
  // Para revisar qué se habría mandado a la edge function.
  console.info('[mock] POST consulta-publica', JSON.stringify(payload))
  await new Promise((r) => setTimeout(r, 1200))
  if (caso === '500') return { tipo: 'error' }
  if (caso === 'token') {
    enviosToken += 1
    if (enviosToken === 1) return { tipo: 'token_invalido' }
  }
  return { tipo: 'ok' }
}
