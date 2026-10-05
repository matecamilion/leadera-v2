/**
 * consulta-publica
 *
 * El backend del link público de consultas (`/c/:slug`). Sin sesión a
 * propósito (`verify_jwt = false` en config.toml): quien consulta no tiene
 * cuenta. Todo corre con service role, así que cada lectura y escritura se
 * acota a mano a la inmobiliaria del link.
 *
 *   GET  ?slug=…  Datos para dibujar la encuesta + token firmado.
 *   POST          Guarda la consulta en `consultas` (la sala de espera) y, si
 *                 califica, la pasa sola a `leads` con consulta_crear_lead.
 *
 * El POST responde SIEMPRE lo mismo (200 `{"ok":true}`) en todos los
 * desenlaces de negocio: guardada, auto-aceptada, vinculada, duplicado de otro
 * agente, límite del plan, honeypot, envío en menos de 8 s, rate limit y
 * repetida. Así no se puede usar para averiguar si un teléfono o un email ya
 * son leads. Para que tampoco lo delate el tiempo, todas las respuestas del
 * POST salen recién pasados PISO_RESPUESTA_POST_MS desde que llegó el pedido.
 *
 * Los únicos errores que ve la página no dependen de los datos de nadie:
 * JSON roto, token inválido, payload fuera de esquema, link no disponible y
 * no haber podido guardar la consulta (el único caso en que se perdería).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { normalizarTelefonoAR } from '../_shared/telefono.ts'
import { buscarLeadExistente } from './duplicados.ts'
import {
  type ContextoEncuesta,
  limitesMonto,
  type Operacion,
  OPERACIONES,
  type PreguntaOpcional,
  RANGOS_PRESUPUESTO,
  type TipoPropiedad,
  validarPost,
} from './encuesta.ts'
import { armarBusqueda, armarResumen, calificar, type PropiedadPublica } from './puntaje.ts'
import { emitirToken, RE_SLUG, verificarToken } from './token.ts'

const METODOS = 'GET, POST, OPTIONS'

/**
 * Estados de suscripción sin acceso a la app. COPIA de `ESTADOS_BLOQUEANTES`
 * en `src/lib/api/suscripcion.ts` (lo que mira `SuscripcionGuard` a través de
 * `estaBloqueada`): TRIAL, ACTIVA y GRACIA cuentan como vigentes. Si cambia
 * allá, cambia acá.
 */
const ESTADOS_SUSCRIPCION_BLOQUEANTES = ['VENCIDA', 'CANCELADA']

const MIN_COMPLETADO_MS = 8_000
const PISO_RESPUESTA_POST_MS = 1_200
const MAX_CUERPO_BYTES = 16 * 1024
const MAX_FOTOS = 6

const UNA_HORA_MS = 60 * 60 * 1000
const VENTANA_REPETIDA_MS = 24 * UNA_HORA_MS

/**
 * Altos a propósito: con CGNAT, muchos celulares de una misma operadora salen
 * a internet con la misma IP.
 */
const RATE_LIMIT = {
  porIpPorHora: 20,
  porIpYLinkPorHora: 5,
  porLinkSinIpPorHora: 30,
}

/** Estados del lead existente que hacen destacar "Volvió a consultar". */
const ESTADOS_VOLVIO = ['FRIO', 'INACTIVO', 'GANADO']

const PREGUNTAS_OPCIONALES: PreguntaOpcional[] = ['visita', 'vender', 'email']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req, METODOS)

  if (req.method === 'GET') {
    try {
      return await manejarGet(req)
    } catch (e) {
      console.error('consulta-publica GET', e)
      return errorResponse(req, 'Error interno.', 500, 'ERROR_INTERNO')
    }
  }

  if (req.method === 'POST') {
    const inicio = Date.now()
    let respuesta: Response
    try {
      respuesta = await manejarPost(req)
    } catch (e) {
      console.error('consulta-publica POST', e)
      respuesta = errorResponse(
        req,
        'No pudimos enviar tu consulta. Probá de nuevo en un momento.',
        500,
        'ERROR_INTERNO',
      )
    }
    const resto = PISO_RESPUESTA_POST_MS - (Date.now() - inicio)
    if (resto > 0) await new Promise((r) => setTimeout(r, resto))
    return respuesta
  }

  return errorResponse(req, 'Método no permitido.', 405, 'METODO_NO_PERMITIDO')
})

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

interface PropiedadDelLink extends PropiedadPublica {
  finalidad: 'VENTA' | 'ALQUILER' | 'AMBAS' | null
  ambientes: number | null
  metros_cuadrados: number | null
  fotos_urls: string[]
  disponible: boolean
}

interface LinkCargado {
  id: string
  slug: string
  inmobiliaria_id: string
  agente_id: string
  propiedad_id: string | null
  preguntas_off: PreguntaOpcional[]
  visitas: number
  asesor: { nombre: string; apellido: string }
  inmobiliaria: { nombre: string }
  propiedad: PropiedadDelLink | null
}

/**
 * El link con todo lo que hace falta, o null si no está disponible.
 *
 * "No disponible" junta, sin distinguirlos: slug inexistente, link inactivo,
 * agente inactivo y cuenta sin acceso a la app. Un error de lectura NO es "no
 * disponible": se propaga y termina en 500.
 */
async function cargarLink(admin: SupabaseClient, slug: string): Promise<LinkCargado | null> {
  const { data: link, error } = await admin
    .from('links_consulta')
    .select('id, slug, inmobiliaria_id, agente_id, propiedad_id, activo, preguntas_off, visitas')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`links_consulta: ${error.message}`)
  if (!link || !link.activo) return null

  const [perfil, inmobiliaria, propiedad] = await Promise.all([
    admin
      .from('profiles')
      .select('nombre, apellido, activo')
      .eq('id', link.agente_id)
      .maybeSingle(),
    admin
      .from('inmobiliarias')
      .select('nombre, estado_suscripcion')
      .eq('id', link.inmobiliaria_id)
      .maybeSingle(),
    link.propiedad_id
      ? admin
        .from('propiedades')
        .select('tipo, finalidad, zona, precio, moneda, ambientes, metros_cuadrados, fotos_urls, estado, inmobiliaria_id')
        .eq('id', link.propiedad_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const fallo = perfil.error ?? inmobiliaria.error ?? propiedad.error
  if (fallo) throw new Error(`cargarLink: ${fallo.message}`)

  if (!perfil.data || !perfil.data.activo) return null
  if (!inmobiliaria.data) return null
  if (ESTADOS_SUSCRIPCION_BLOQUEANTES.includes(inmobiliaria.data.estado_suscripcion)) return null

  // Con la propiedad borrada el link ya no existiría (cascade). Si aparece de
  // otra inmobiliaria es un dato roto: se trata como link no disponible.
  const p = propiedad.data
  if (link.propiedad_id && (!p || p.inmobiliaria_id !== link.inmobiliaria_id)) return null

  return {
    id: link.id,
    slug: link.slug,
    inmobiliaria_id: link.inmobiliaria_id,
    agente_id: link.agente_id,
    propiedad_id: link.propiedad_id,
    preguntas_off: (link.preguntas_off ?? []).filter((x: string): x is PreguntaOpcional =>
      (PREGUNTAS_OPCIONALES as string[]).includes(x)
    ),
    visitas: link.visitas ?? 0,
    asesor: { nombre: perfil.data.nombre, apellido: perfil.data.apellido },
    inmobiliaria: { nombre: inmobiliaria.data.nombre },
    propiedad: p
      ? {
        tipo: p.tipo as TipoPropiedad,
        finalidad: p.finalidad,
        zona: p.zona,
        precio: p.precio === null ? null : Number(p.precio),
        moneda: p.moneda,
        ambientes: p.ambientes,
        metros_cuadrados: p.metros_cuadrados === null ? null : Number(p.metros_cuadrados),
        fotos_urls: (p.fotos_urls ?? []).slice(0, MAX_FOTOS),
        disponible: p.estado === 'DISPONIBLE',
      }
      : null,
  }
}

/** Qué encuesta corresponde: la de la propiedad solo si sigue disponible. */
function contextoDe(link: LinkCargado): ContextoEncuesta {
  const p = link.propiedad
  if (!p || !p.disponible) {
    return { flujo: 'GENERAL', operacionFija: null, preguntasOff: link.preguntas_off }
  }
  const operacionFija: Operacion | null = p.finalidad === 'VENTA'
    ? 'COMPRA'
    : p.finalidad === 'ALQUILER'
    ? 'ALQUILER'
    : null
  return { flujo: 'PROPIEDAD', operacionFija, preguntasOff: link.preguntas_off }
}

function linkNoDisponible(req: Request): Response {
  return errorResponse(req, 'Este link ya no está disponible.', 404, 'LINK_NO_DISPONIBLE')
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

async function manejarGet(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get('slug') ?? ''
  if (!RE_SLUG.test(slug)) return linkNoDisponible(req)

  const admin = adminClient()
  const link = await cargarLink(admin, slug)
  if (!link) return linkNoDisponible(req)

  // Aproximado a propósito (leer y escribir, sin RPC): dos visitas
  // simultáneas pueden contar como una. Es una métrica de vanidad.
  const { error: errorVisitas } = await admin
    .from('links_consulta')
    .update({ visitas: link.visitas + 1 })
    .eq('id', link.id)
  if (errorVisitas) console.error('consulta-publica visitas', errorVisitas.message)

  const ctx = contextoDe(link)
  const p = link.propiedad

  return jsonResponse(req, {
    token: await emitirToken(link.slug),
    link: {
      slug: link.slug,
      tipo: link.propiedad_id ? 'PROPIEDAD' : 'GENERAL',
      preguntas_off: link.preguntas_off,
    },
    flujo: ctx.flujo,
    operacion_fija: ctx.operacionFija,
    asesor: link.asesor,
    inmobiliaria: link.inmobiliaria,
    // Nunca la dirección. Si no está disponible, solo eso.
    propiedad: !p ? null : !p.disponible ? { disponible: false } : {
      disponible: true,
      tipo: p.tipo,
      finalidad: p.finalidad,
      zona: p.zona,
      precio: p.precio,
      moneda: p.moneda,
      ambientes: p.ambientes,
      metros_cuadrados: p.metros_cuadrados,
      fotos_urls: p.fotos_urls,
    },
    // Las cuatro operaciones, con la moneda de cada rango: en los alquileres
    // la página filtra por la moneda que elige la persona. Los rangos abiertos
    // ("Más de …") traen `monto`: la página pide el monto solo si viene, así
    // nunca lo manda a una edge que lo rechazaría.
    rangos_presupuesto: Object.fromEntries(
      OPERACIONES.map((op) => [
        op,
        RANGOS_PRESUPUESTO[op].map(({ codigo, label, moneda }) => {
          const monto = limitesMonto(op, codigo)
          return { codigo, label, moneda, ...(monto ? { monto } : {}) }
        }),
      ]),
    ),
  })
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

/** La única respuesta de éxito. Todos los desenlaces de negocio pasan por acá. */
function respuestaOk(req: Request): Response {
  return jsonResponse(req, { ok: true })
}

type MotivoOkFalso = 'honeypot' | 'rapido' | 'rate_limit' | 'repetida'

/** Un desenlace que no guarda nada pero responde igual que uno que sí. */
function okFalso(req: Request, motivo: MotivoOkFalso, slug: string | null): Response {
  // Sin teléfono, email, nombre ni IP.
  console.info(JSON.stringify({ evento: 'consulta_ok_falso', motivo, slug }))
  return respuestaOk(req)
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Primer segmento del token, solo para los logs (sin verificar). */
function slugParaLog(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const slug = token.split('.')[0]
  return RE_SLUG.test(slug) ? slug : null
}

async function manejarPost(req: Request): Promise<Response> {
  // 1. Tamaño y JSON -----------------------------------------------------------
  const largoDeclarado = Number(req.headers.get('content-length') ?? '0')
  if (largoDeclarado > MAX_CUERPO_BYTES) {
    return errorResponse(req, 'El pedido es demasiado grande.', 400, 'INPUT_INVALIDO')
  }
  const cuerpo = await req.text()
  if (cuerpo.length > MAX_CUERPO_BYTES) {
    return errorResponse(req, 'El pedido es demasiado grande.', 400, 'INPUT_INVALIDO')
  }

  let datos: unknown
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return errorResponse(req, 'El cuerpo no es un JSON válido.', 400, 'JSON_INVALIDO')
  }
  if (!esObjeto(datos)) {
    return errorResponse(req, 'El cuerpo tiene que ser un objeto JSON.', 400, 'INPUT_INVALIDO')
  }

  // 2. Honeypot: antes que cualquier validación, para que un bot no aprenda
  //    nada de los 400.
  if (datos.hp !== undefined && datos.hp !== '') {
    return okFalso(req, 'honeypot', slugParaLog(datos.token))
  }

  // 3. Token ------------------------------------------------------------------
  const token = await verificarToken(datos.token)
  if (!token) {
    return errorResponse(
      req,
      'La página venció. Recargala para enviar tu consulta.',
      400,
      'TOKEN_INVALIDO',
    )
  }

  // 4. Menos de 8 s, medido con el instante firmado del GET.
  if (Date.now() - token.emitido < MIN_COMPLETADO_MS) {
    return okFalso(req, 'rapido', token.slug)
  }

  // 5. Link -------------------------------------------------------------------
  const admin = adminClient()
  const link = await cargarLink(admin, token.slug)
  if (!link) return linkNoDisponible(req)
  const ctx = contextoDe(link)

  // 6. Esquema ----------------------------------------------------------------
  const validado = validarPost(datos, ctx)
  if (!validado.ok) return errorResponse(req, validado.error, 400, 'INPUT_INVALIDO')
  const { respuestas, contacto } = validado.valor

  const telefonoNorm = normalizarTelefonoAR(contacto.telefono)
  if (!/^[0-9]{8,15}$/.test(telefonoNorm)) {
    return errorResponse(req, 'El teléfono no parece válido.', 400, 'INPUT_INVALIDO')
  }

  // 7. Rate limit -------------------------------------------------------------
  const ipHash = await hashDeIp(req)
  if (await superaRateLimit(admin, link, ipHash)) {
    return okFalso(req, 'rate_limit', link.slug)
  }

  // 8. Repetida: misma persona, mismo agente, todavía pendiente.
  if (await esRepetida(admin, link, telefonoNorm)) {
    return okFalso(req, 'repetida', link.slug)
  }

  // 9. Calificación y textos ----------------------------------------------------
  const cal = calificar(ctx.flujo, respuestas, contacto)
  const propiedadMostrada = ctx.flujo === 'PROPIEDAD' ? link.propiedad : null
  const resumen = armarResumen(ctx.flujo, respuestas, cal, link.propiedad)
  const busqueda = armarBusqueda(ctx.flujo, respuestas, propiedadMostrada)

  // 10. Duplicados. Si la búsqueda falla, la consulta igual se guarda, pero
  //     queda en la bandeja: sin saber si es duplicado no se la pasa sola.
  let existente: Awaited<ReturnType<typeof buscarLeadExistente>> = null
  let avisoPendiente: string | null = null
  try {
    existente = await buscarLeadExistente(
      admin,
      link.inmobiliaria_id,
      link.agente_id,
      contacto.telefono,
      telefonoNorm,
      contacto.email,
    )
  } catch (e) {
    console.error('consulta-publica duplicados', e instanceof Error ? e.message : e)
    avisoPendiente = 'No se pudo verificar si ya era un lead; revisala antes de aceptarla.'
  }

  const mismoAgente = existente !== null && existente.agente_id === link.agente_id
  const ahora = new Date().toISOString()

  // 11. Insert --------------------------------------------------------------
  const { data: insertada, error: errorInsert } = await admin
    .from('consultas')
    .insert({
      link_id: link.id,
      inmobiliaria_id: link.inmobiliaria_id,
      agente_id: link.agente_id,
      propiedad_id: link.propiedad_id,
      nombre: contacto.nombre,
      apellido: contacto.apellido,
      telefono: contacto.telefono,
      telefono_norm: telefonoNorm,
      email: contacto.email,
      respuestas: { flujo: ctx.flujo, ...respuestas },
      resumen,
      busqueda,
      puntaje: cal.puntaje,
      temperatura: cal.temperatura,
      presupuesto_respondido: cal.presupuestoRespondido,
      posible_captacion: cal.posibleCaptacion,
      // VINCULADA nace resuelta: lo exige consultas_resolucion_coherente.
      estado: mismoAgente ? 'VINCULADA' : 'PENDIENTE',
      lead_id: mismoAgente ? existente!.id : null,
      resuelta_at: mismoAgente ? ahora : null,
      lead_existente_id: existente?.id ?? null,
      duplicado_por: existente?.por ?? null,
      duplicado_otro_agente: existente !== null && !mismoAgente,
      volvio_a_consultar: existente !== null && ESTADOS_VOLVIO.includes(existente.estado ?? ''),
      aviso_pendiente: avisoPendiente,
      consentimiento_at: ahora,
      ip_hash: ipHash,
    })
    .select('id')
    .single()

  // El único desenlace en que la consulta se perdería: se le avisa a la página
  // para que ofrezca reintentar.
  if (errorInsert || !insertada) throw new Error(`insert consultas: ${errorInsert?.message}`)

  // 12. Pase automático. La consulta ya está guardada como PENDIENTE: pase lo
  //     que pase acá, no se pierde.
  if (existente === null && avisoPendiente === null && cal.autoAceptable) {
    await pasarALeads(admin, insertada.id)
  }

  return respuestaOk(req)
}

/**
 * consulta_crear_lead('AUTO_ACEPTADA').
 *
 * LIMITE_ALCANZADO: la RPC ya dejó la consulta PENDIENTE con su aviso.
 * Cualquier error: la transacción de la RPC se revierte entera y la consulta
 * sigue PENDIENTE; se deja el motivo en `aviso_pendiente` para la bandeja.
 */
async function pasarALeads(admin: SupabaseClient, consultaId: string): Promise<void> {
  const { data, error } = await admin.rpc('consulta_crear_lead', {
    p_consulta_id: consultaId,
    p_estado: 'AUTO_ACEPTADA',
  })

  if (!error) {
    const resultado = Array.isArray(data) ? data[0]?.resultado : null
    if (resultado !== 'OK') {
      console.info(JSON.stringify({ evento: 'consulta_auto_no_paso', consulta_id: consultaId, resultado }))
    }
    return
  }

  console.error('consulta-publica pase automático', consultaId, error.message)
  const { error: errorAviso } = await admin
    .from('consultas')
    .update({
      aviso_pendiente: `No se pudo pasar automáticamente: ${error.message}`.slice(0, 500),
    })
    .eq('id', consultaId)
    .eq('estado', 'PENDIENTE')
  if (errorAviso) console.error('consulta-publica aviso', consultaId, errorAviso.message)
}

// ---------------------------------------------------------------------------
// IP y rate limit
// ---------------------------------------------------------------------------

/**
 * La IP del cliente, según los headers del proxy.
 *
 * Verificado contra el proxy de Supabase (E2, 2026-10-01):
 *   - `cf-connecting-ip` trae la IP real y no se puede falsear: un pedido que
 *     lo manda inventado lo rechaza Cloudflare (error 1000) antes de llegar.
 *   - `x-forwarded-for` también trae la IP real primero; un valor falso que
 *     mande el cliente se descarta.
 * Por eso se usa `cf-connecting-ip` y, si faltara, el primer elemento de
 * `x-forwarded-for`.
 */
function ipDelCliente(req: Request): string | null {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const primero = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (primero) return primero
  return req.headers.get('x-real-ip')?.trim() || null
}

/** sha256(CONSULTA_IP_SALT + ip) en hex, o null sin IP o sin salt. */
async function hashDeIp(req: Request): Promise<string | null> {
  const ip = ipDelCliente(req)
  if (!ip) return null

  const salt = Deno.env.get('CONSULTA_IP_SALT')
  if (!salt) {
    console.error('consulta-publica: falta CONSULTA_IP_SALT; el rate limit cae al tope por link')
    return null
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ip))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function contar(
  consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await consulta
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Sobre `consultas` guardadas en la última hora. Si el conteo falla, deja
 * pasar: un rate limit roto no puede tirar consultas legítimas.
 */
async function superaRateLimit(
  admin: SupabaseClient,
  link: LinkCargado,
  ipHash: string | null,
): Promise<boolean> {
  const desde = new Date(Date.now() - UNA_HORA_MS).toISOString()
  const base = () =>
    admin.from('consultas').select('id', { count: 'exact', head: true }).gte('created_at', desde)

  try {
    if (ipHash) {
      const [porIp, porIpYLink] = await Promise.all([
        contar(base().eq('ip_hash', ipHash)),
        contar(base().eq('ip_hash', ipHash).eq('link_id', link.id)),
      ])
      return porIp >= RATE_LIMIT.porIpPorHora || porIpYLink >= RATE_LIMIT.porIpYLinkPorHora
    }
    const porLink = await contar(base().eq('link_id', link.id).is('ip_hash', null))
    return porLink >= RATE_LIMIT.porLinkSinIpPorHora
  } catch (e) {
    console.error('consulta-publica rate limit', e instanceof Error ? e.message : e)
    return false
  }
}

/** Ya hay una PENDIENTE de este teléfono para este agente en las últimas 24 h. */
async function esRepetida(
  admin: SupabaseClient,
  link: LinkCargado,
  telefonoNorm: string,
): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_REPETIDA_MS).toISOString()
  try {
    const n = await contar(
      admin
        .from('consultas')
        .select('id', { count: 'exact', head: true })
        .eq('agente_id', link.agente_id)
        .eq('telefono_norm', telefonoNorm)
        .eq('estado', 'PENDIENTE')
        .gte('created_at', desde),
    )
    return n > 0
  } catch (e) {
    console.error('consulta-publica repetida', e instanceof Error ? e.message : e)
    return false
  }
}
