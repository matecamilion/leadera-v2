/**
 * enviar-reportes-semanales
 *
 * La corrida del reporte semanal: recorre los agentes que lo pidieron, calcula
 * sus métricas de la última semana completa, arma el HTML y lo manda por
 * Resend. La dispara el cron los lunes a las 9 de la mañana de Argentina.
 *
 * Un agente que falla no frena a los demás: cada uno va en su propio try.
 *
 * Entrada (toda opcional, para probar a mano):
 *   { "agente_id": "<uuid>" }        → una sola cuenta.
 *   { "destinatario": "a@b.com" }    → manda a esa dirección en vez de a la
 *                                      del agente. Para probar sin escribirle
 *                                      a nadie.
 *   { "dry_run": true }              → calcula y arma el HTML, no manda nada.
 *   { "hoy": "YYYY-MM-DD" }          → reporta la semana anterior a esa fecha.
 *
 * Secretos: RESEND_API_KEY.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { firmarBaja } from '../_shared/firmaBaja.ts'
import { armarReporte, hoyEnZona, renderizar } from '../_shared/reporteSemanal.ts'

const RESEND_API = 'https://api.resend.com/emails'
const REMITENTE = 'LeadEra <reportes@mail.leadera.com.ar>'
const TIMEOUT_RESEND_MS = 15_000

interface Perfil {
  id: string
  nombre: string | null
  email: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return new Response('forbidden', { status: 403 })
  }

  const entrada = (await req.json().catch(() => ({}))) as {
    agente_id?: string
    destinatario?: string
    dry_run?: boolean
    hoy?: string
  }

  const admin = adminClient()
  const hoy = entrada.hoy ?? hoyEnZona()

  // `activo`: a un miembro desactivado no se le escribe. Su fila sigue en
  // profiles —desactivar no borra a nadie— pero ya no trabaja en la agencia.
  let query = admin
    .from('profiles')
    .select('id, nombre, email')
    .eq('reporte_semanal_activo', true)
    .eq('activo', true)
  if (entrada.agente_id) query = query.eq('id', entrada.agente_id)

  const { data: perfiles, error } = await query
  if (error) {
    console.error('enviar-reportes-semanales: no se pudieron leer los agentes', error)
    return Response.json({ error: 'lectura_agentes', detalle: error.message }, { status: 500 })
  }

  const resultados = []
  for (const perfil of (perfiles ?? []) as Perfil[]) {
    resultados.push(await enviarA(admin, perfil, hoy, entrada))
  }

  return Response.json({
    semana_de: hoy,
    agentes: resultados.length,
    enviados: resultados.filter((r) => r.resultado === 'enviado').length,
    resultados,
  })
})

async function enviarA(
  admin: ReturnType<typeof adminClient>,
  perfil: Perfil,
  hoy: string,
  entrada: { destinatario?: string; dry_run?: boolean },
) {
  const base = { agente_id: perfil.id, email: entrada.destinatario ?? perfil.email }

  try {
    const destino = entrada.destinatario ?? perfil.email
    if (!destino) return { ...base, resultado: 'sin_email' }

    const urlBaja = `${Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '')}/functions/v1/reporte-semanal-baja?t=${encodeURIComponent(await firmarBaja(perfil.id))}`

    const reporte = await armarReporte(admin, perfil, hoy, urlBaja)
    const html = renderizar(reporte.variables)

    if (entrada.dry_run) {
      return { ...base, resultado: 'dry_run', metricas: reporte.metricas, variables: reporte.variables }
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('Falta RESEND_API_KEY')

    const respuesta = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: [destino],
        subject: `Tu semana en LeadEra · ${reporte.variables.week_range}`,
        html,
        // Gmail y Outlook muestran "Cancelar suscripción" arriba del mail con
        // esto, y de paso mejora la reputación del dominio. El POST es el que
        // usan los clientes que dan de baja sin abrir el link.
        headers: {
          'List-Unsubscribe': `<${urlBaja}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_RESEND_MS),
    })

    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 300)
      throw new Error(`Resend ${respuesta.status}: ${detalle}`)
    }

    const datos = (await respuesta.json()) as { id?: string }
    return { ...base, resultado: 'enviado', email_id: datos.id ?? null, metricas: reporte.metricas }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    console.error(`enviar-reportes-semanales: ${perfil.id}`, mensaje)
    return { ...base, resultado: 'error', error: mensaje }
  }
}

function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
