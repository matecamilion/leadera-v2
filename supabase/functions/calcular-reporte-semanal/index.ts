/**
 * calcular-reporte-semanal
 *
 * Los números del reporte de UN agente, sin mandar ningún mail. Sirve para
 * revisar a mano qué va a decir el reporte antes de que salga, y para depurar
 * un número que no cierra.
 *
 * Entrada: `{ "agente_id": "<uuid>", "hoy": "YYYY-MM-DD" }`. `hoy` es opcional
 * y sirve para pedir el reporte de otra semana: siempre se calcula la última
 * semana completa ANTES de esa fecha.
 *
 * Sólo service_role: recibe un agente por parámetro y devuelve su actividad.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { armarReporte, hoyEnZona } from '../_shared/reporteSemanal.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return new Response('forbidden', { status: 403 })
  }

  const entrada = (await req.json().catch(() => ({}))) as { agente_id?: string; hoy?: string }
  if (!entrada.agente_id) {
    return Response.json({ error: 'Falta agente_id' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: perfil, error } = await admin
    .from('profiles')
    .select('id, nombre, apellido, email, reporte_semanal_activo')
    .eq('id', entrada.agente_id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!perfil) return Response.json({ error: 'No existe ese agente' }, { status: 404 })

  try {
    const reporte = await armarReporte(admin, perfil, entrada.hoy ?? hoyEnZona())
    return Response.json({
      agente: { id: perfil.id, nombre: perfil.nombre, email: perfil.email },
      // Se informa aunque no cambie el cálculo: es el dato que explica por qué
      // a este agente el cron no le manda nada.
      reporte_semanal_activo: perfil.reporte_semanal_activo === true,
      ...reporte,
    })
  } catch (err) {
    console.error('calcular-reporte-semanal', err)
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
})

function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
