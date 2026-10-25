/**
 * La sección "Tu gestión" del reporte semanal: tres anillos de progreso contra
 * la meta semanal del modelo de gestión.
 *
 * Los clientes de mail no renderizan SVG, así que los anillos son PNG
 * pre-generados (scripts/generar-anillos-email.ts), de 0% a 100% de a 5%. El
 * anillo no lleva número: el número va en texto debajo, que además es lo que se
 * ve si el cliente bloquea las imágenes.
 *
 * Todo puro y sin dependencias de Deno, para poder probarlo desde vitest.
 */
import { METAS_GESTION } from './metasGestion.ts'

const URL_ANILLOS = 'https://app.leadera.com.ar/email/anillos/'

/** Lo que devuelve `resumen_gestion_agente` y que esta sección necesita. */
export interface ResumenGestion {
  periodo_inicio: string
  verdes: number
  prelistings: number
  prebuyings: number
  nuevos_contactos: number
}

/**
 * El PNG del anillo más cercano al avance real.
 *
 * 0 y 100 son casos aparte: el 0 es "no hay nada" y el 100 es "se llegó a la
 * meta". Un avance parcial nunca cae en ninguno de los dos, aunque el redondeo
 * lo empuje (1 de 100 no es 0%, 199 de 200 no es 100%).
 */
export function nombreAnillo(valor: number, meta: number): string {
  if (meta <= 0 || valor <= 0) return 'anillo-000.png'
  if (valor >= meta) return 'anillo-100.png'

  const paso = Math.min(95, Math.max(5, Math.round((valor / meta) * 20) * 5))
  return `anillo-${String(paso).padStart(3, '0')}.png`
}

export function textoEstado(valor: number, meta: number): string {
  if (valor >= meta) return 'Meta cumplida'
  const faltan = meta - valor
  return faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`
}

interface Anillo {
  etiqueta: string
  valor: number
  meta: number
}

function celda(a: Anillo): string {
  const cumplida = a.valor >= a.meta
  const texto = `${a.valor} de ${a.meta}`
  return `<td class="gestion-card" width="33%" valign="top" align="center" bgcolor="#eef7f3" style="width:33%; background-color:#eef7f3; border-radius:12px; padding:16px 8px 14px;">
                    <img src="${URL_ANILLOS}${nombreAnillo(a.valor, a.meta)}" width="88" height="88" alt="${texto}" style="display:block; margin:0 auto;">
                    <div style="color:#0b1f1a; font-size:17px; line-height:22px; font-weight:750; padding-top:8px;">${texto}</div>
                    <div style="color:#0b1f1a; font-size:13px; line-height:17px; font-weight:600; padding-top:3px;">${a.etiqueta}</div>
                    <div style="color:${cumplida ? '#0f6e56' : '#4d6b62'}; font-size:12px; line-height:16px; font-weight:${cumplida ? '700' : '500'}; padding-top:3px;">${textoEstado(a.valor, a.meta)}</div>
                  </td>`
}

/**
 * Semana sin nada registrado en ninguna de las tres métricas. Tres anillos
 * vacíos se leerían como un reproche para quien todavía no usa el modelo, así
 * que en ese caso la sección invita en vez de mostrar el avance.
 */
export function esEstadoVacio(verdes: number, preTotal: number, nuevos: number): boolean {
  return verdes === 0 && preTotal === 0 && nuevos === 0
}

/** La variante vacía: una tarjeta de invitación, sin imágenes. */
function seccionVaciaHtml(): string {
  const contactos =
    METAS_GESTION.nuevosContactos === 1
      ? '1 contacto nuevo'
      : `${METAS_GESTION.nuevosContactos} contactos nuevos`
  const metas =
    `Tus metas semanales: ${METAS_GESTION.verdes} reuniones y visitas, ` +
    `${METAS_GESTION.preListingBuying} prelistings y prebuyings, ${contactos}.`

  return `<!-- TU GESTION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td valign="middle" style="color:#0b1f1a; font-size:16px; line-height:22px; font-weight:750; padding-bottom:10px;">Tu gestión</td>
                  <td align="right" valign="middle" style="color:#4d6b62; font-size:12px; line-height:16px; padding-bottom:10px;">Metas semanales</td>
                </tr>
                <tr>
                  <td colspan="2" bgcolor="#eef7f3" style="background-color:#eef7f3; border-radius:12px; padding:18px 20px;">
                    <div style="color:#0b1f1a; font-size:14px; line-height:20px; font-weight:600;">Todavía no hay actividad registrada esta semana.</div>
                    <div style="color:#4d6b62; font-size:13px; line-height:19px; padding-top:6px;">Cargá tus visitas y reuniones en LeadEra y mirá cómo avanzan tus anillos.</div>
                    <div style="color:#4d6b62; font-size:12px; line-height:17px; padding-top:10px;">${metas}</div>
                  </td>
                </tr>
              </table>
              `
}

/**
 * El bloque HTML de la sección. Todo lo que se interpola son números y textos
 * fijos de este archivo: nada que venga de un campo de texto libre.
 */
export function seccionGestionHtml(r: ResumenGestion): string {
  if (esEstadoVacio(r.verdes, r.prelistings + r.prebuyings, r.nuevos_contactos)) {
    return seccionVaciaHtml()
  }

  const anillos: Anillo[] = [
    { etiqueta: 'Reuniones y visitas', valor: r.verdes, meta: METAS_GESTION.verdes },
    {
      etiqueta: 'Prelistings y prebuyings',
      valor: r.prelistings + r.prebuyings,
      meta: METAS_GESTION.preListingBuying,
    },
    { etiqueta: 'Contactos nuevos', valor: r.nuevos_contactos, meta: METAS_GESTION.nuevosContactos },
  ]
  const separador = '<td class="gestion-gap" width="8" style="width:8px; font-size:0; line-height:0;">&nbsp;</td>'

  return `<!-- TU GESTION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td valign="middle" style="color:#0b1f1a; font-size:16px; line-height:22px; font-weight:750; padding-bottom:10px;">Tu gestión</td>
                  <td align="right" valign="middle" style="color:#4d6b62; font-size:12px; line-height:16px; padding-bottom:10px;">Metas semanales</td>
                </tr>
                <tr>
                  <td colspan="2">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                  ${anillos.map(celda).join(`\n                  ${separador}\n                  `)}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              `
}
