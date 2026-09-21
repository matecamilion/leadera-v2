/**
 * reporte-semanal-baja
 *
 * El "Darme de baja" del pie del reporte semanal. Un click y listo: apaga
 * `reporte_semanal_activo` del agente del token y devuelve una página que lo
 * confirma.
 *
 * Sin sesión a propósito (`verify_jwt = false` en config.toml): el mail se abre
 * en el teléfono, muchas veces sin la app abierta, y pedir login para dejar de
 * recibir un mail termina en el botón de spam. La autorización la da el token
 * firmado (ver `_shared/firmaBaja.ts`), que sólo sirve para apagar esa
 * preferencia de ese agente.
 *
 * Acepta GET —el click del link— y POST, que es lo que manda Gmail con el
 * header `List-Unsubscribe-Post` sin abrir nada.
 */
import { adminClient } from '../_shared/supabase.ts'
import { verificarBaja } from '../_shared/firmaBaja.ts'

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 })
  }

  const token = new URL(req.url).searchParams.get('t')
  const agenteId = token ? await verificarBaja(token) : null

  if (!agenteId) {
    return pagina(
      'Link inválido',
      'Este link de baja no es válido o está incompleto. Podés desactivar el reporte desde tu perfil en LeadEra.',
      400,
    )
  }

  const { data, error } = await adminClient()
    .from('profiles')
    .update({ reporte_semanal_activo: false })
    .eq('id', agenteId)
    .select('id')

  if (error) {
    console.error('reporte-semanal-baja', error)
    return pagina(
      'No pudimos darte de baja',
      'Hubo un problema de nuestro lado. Probá de nuevo en un rato o desactivalo desde tu perfil.',
      500,
    )
  }

  // Sin filas: el agente ya no existe. Para el que hizo click el resultado es
  // el mismo —no va a recibir más el reporte—, así que no se le muestra un
  // error por algo que no puede resolver.
  if (!data || data.length === 0) {
    return pagina('Listo', 'No vas a recibir más el reporte semanal.')
  }

  // El POST de Gmail no muestra nada: alcanza con un 200.
  if (req.method === 'POST') return new Response(null, { status: 200 })

  return pagina(
    'Listo, te diste de baja',
    'No vas a recibir más el reporte semanal. Si cambiás de idea, podés volver a activarlo desde tu perfil en LeadEra.',
  )
})

/** La misma página para los tres desenlaces: título, texto y un link a la app. */
function pagina(titulo: string, texto: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · LeadEra</title>
</head>
<body style="margin:0; background:#f7f8fa; font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px; margin:80px auto; padding:0 20px;">
    <div style="background:#ffffff; border:1px solid #e3e6ea; border-radius:14px; padding:32px;">
      <div style="color:#0f6e5c; font-size:17px; font-weight:700; letter-spacing:-0.4px; margin-bottom:18px;">LeadEra</div>
      <h1 style="margin:0 0 10px; color:#1a1f24; font-size:20px; line-height:26px;">${titulo}</h1>
      <p style="margin:0 0 22px; color:#5a6779; font-size:14px; line-height:21px;">${texto}</p>
      <a href="https://app.leadera.com.ar/perfil" style="display:inline-block; background:#0f6e5c; color:#ffffff; border-radius:9px; padding:12px 20px; font-size:14px; font-weight:600; text-decoration:none;">Ir a mi perfil</a>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
