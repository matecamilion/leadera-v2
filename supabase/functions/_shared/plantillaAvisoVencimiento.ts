import { ALIAS_TRANSFERENCIA, TITULAR_TRANSFERENCIA } from './cobro.ts'

/**
 * `ULTIMO_DIA_GRACIA` ya no se manda (las cuentas manuales no tienen gracia),
 * pero el CHECK de `avisos_vencimiento` lo sigue admitiendo por los registros
 * históricos.
 */
export type TipoAviso = 'PREVIO' | 'DIA_VENCIMIENTO'

export interface DatosAviso {
  tipo: TipoAviso
  /** Nombre del dueño. Sin él, el saludo va sin nombre. */
  nombre: string | null
  inmobiliaria: string
  plan: string
  /** Ya formateado, con símbolo; null si el plan no tiene precio cargado. */
  monto: string | null
  /** Último día con acceso, `DD/MM/AAAA`. */
  vencimiento: string
}

export interface MailAviso {
  asunto: string
  html: string
  texto: string
}

/**
 * El mail de aviso de vencimiento.
 *
 * Misma estructura y estilos en línea que el mail de recuperación de
 * contraseña (plantilla del dashboard de Supabase Auth), para que todos los
 * mails de LeadEra se vean iguales. No lleva botón: lo que hay que hacer es
 * transferir, así que los datos van en el cuerpo y el pie pide el comprobante
 * como respuesta al mail.
 *
 * Además del HTML devuelve una versión en texto plano: los clientes que no
 * muestran HTML la usan, y un mail sin parte de texto puntúa peor como spam.
 */
export function armarAviso(d: DatosAviso): MailAviso {
  const { asunto, titulo, intro } = copy(d)
  const saludo = d.nombre ? `Hola ${d.nombre}:` : 'Hola:'
  const monto = d.monto ?? 'respondé este mail y te lo confirmamos'

  const datos: [string, string][] = [
    ['Plan', d.plan],
    ['Monto mensual', monto],
    ['Alias', ALIAS_TRANSFERENCIA],
    ['Titular', TITULAR_TRANSFERENCIA],
    ['Vencimiento', d.vencimiento],
  ]

  const pie =
    'Cuando hagas la transferencia, respondé este mail con el comprobante y renovamos tu acceso.'

  const filasDatos = datos
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;">${esc(etiqueta)}</td>` +
        `<td style="padding:4px 0;color:#111827;font-weight:bold;">${esc(valor)}</td></tr>`,
    )
    .join('')

  const html = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(intro)}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#f4f6f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:28px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;
                     font-size:22px;font-weight:bold;color:#0f6f5c;">LeadEra</td></tr>
      <tr><td style="padding:20px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;
                     font-size:20px;font-weight:bold;color:#111827;">${esc(titulo)}</td></tr>
      <tr><td style="padding:12px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;
                     font-size:15px;line-height:1.6;color:#374151;">
        <p style="margin:0 0 12px 0;">${esc(saludo)}</p>
        <p style="margin:0 0 16px 0;">${esc(intro)}</p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="width:100%;margin:0 0 24px 0;padding:12px 16px;background:#f4f6f5;border-radius:8px;
                      font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          ${filasDatos}
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #e5e7eb;
                     font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">
        ${esc(pie)}<br><br>
        Recibís este mail porque sos el dueño de la cuenta ${esc(d.inmobiliaria)} en LeadEra.</td></tr>
    </table>
  </td></tr>
</table>`

  const texto = [
    saludo,
    '',
    intro,
    '',
    ...datos.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
    '',
    pie,
    '',
    `Recibís este mail porque sos el dueño de la cuenta ${d.inmobiliaria} en LeadEra.`,
  ].join('\n')

  return { asunto, html, texto }
}

function copy(d: DatosAviso): { asunto: string; titulo: string; intro: string } {
  switch (d.tipo) {
    case 'PREVIO':
      return {
        asunto: `Tu plan de LeadEra vence el ${d.vencimiento}`,
        titulo: 'Tu plan está por vencer',
        intro:
          `Tu plan ${d.plan} de LeadEra vence el ${d.vencimiento}, y ese es el último día en que vas a tener acceso. ` +
          'Para seguir usándolo sin cortes, podés renovarlo por transferencia con estos datos:',
      }

    case 'DIA_VENCIMIENTO':
      return {
        asunto: 'Tu plan de LeadEra vence hoy',
        titulo: 'Hoy es tu último día de acceso',
        intro:
          `Tu plan ${d.plan} de LeadEra vence hoy, ${d.vencimiento}, y hoy es el último día de acceso: ` +
          'mañana se suspende tu cuenta si no registramos el pago. ' +
          'Para evitarlo, renová por transferencia con estos datos:',
      }
  }
}

/** Escapa lo que llega de la base (nombres) antes de meterlo en el HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
