/**
 * La plantilla HTML del reporte semanal, tal cual la aprobó diseño.
 *
 * Vive como string de TypeScript y no como archivo .html porque el bundle de
 * las Edge Functions sólo sube los módulos alcanzables desde el `index.ts`: un
 * .html suelto no viajaría y la función fallaría recién en producción.
 *
 * Las variables van como `{{nombre}}` y las reemplaza `renderizar()`. No se
 * toca nada más del HTML: los `style` inline, las tablas anidadas y los
 * comentarios condicionales son lo que hace que se vea igual en Gmail, Outlook
 * y Apple Mail.
 */
export const PLANTILLA_REPORTE_SEMANAL = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
  <title>Tu semana en LeadEra</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; background:#f7f8fa; }
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    table { border-spacing:0 !important; border-collapse:separate !important; mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    td { padding:0; }
    img { border:0; outline:none; text-decoration:none; display:block; max-width:100%; }
    a { text-decoration:none; }
    .email-container { width:600px; max-width:600px; }
    .mobile-stack { vertical-align:top; }
    @media screen and (max-width:620px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .mobile-padding { padding-left:20px !important; padding-right:20px !important; }
      .hero-copy { width:100% !important; display:block !important; }
      .hero-image { display:none !important; }
      .mobile-stack { display:block !important; width:100% !important; }
      .mobile-card-gap { padding-right:0 !important; padding-bottom:12px !important; }
      .metric-card { width:100% !important; }
      .hero-title { font-size:34px !important; line-height:38px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f7f8fa;">

  <div style="display:none; font-size:1px; color:#f7f8fa; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
    Tu resumen semanal de actividad en LeadEra.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f7f8fa;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 18px rgba(15, 35, 30, 0.06);">

          <!-- HERO -->
          <tr>
            <td style="background-color:#0a4438; overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">

                <!-- LOGO / TOP -->
                <tr>
                  <td class="mobile-padding" style="padding:28px 34px 0 34px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="padding-right:10px;">
                                <img src="https://www.leadera.com.ar/leadera-logo-icon.png" width="29" height="29" alt="LeadEra">
                              </td>
                              <td valign="middle" style="color:#ffffff; font-size:25px; line-height:28px; font-weight:700; letter-spacing:-0.7px;">
                                LeadEra
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" valign="middle" style="color:#ffffff; font-size:11px; line-height:15px; font-weight:500;">
                          <strong style="font-weight:700;">Tu CRM inmobiliario</strong><br>
                          <span style="color:#d7ebe6;">Más oportunidades. Más cierres.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- HERO CONTENT -->
                <tr>
                  <td style="padding-top:32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="hero-copy" width="58%" valign="top" style="width:58%; padding:0 10px 38px 34px;">
                          <div class="hero-title" style="color:#ffffff; font-size:38px; line-height:42px; font-weight:750; letter-spacing:-1.4px; margin:0 0 14px 0;">
                            ¡Buenos días,<br>{{agent_name}}!
                          </div>
                          <div style="color:#dcebe7; font-size:15px; line-height:23px; font-weight:400; max-width:230px;">
                            Acá tenés tu resumen semanal.<br>Seguís creciendo y acercándote<br>a tus objetivos.
                          </div>
                        </td>
                        <td class="hero-image" width="42%" valign="bottom" align="right" style="width:42%; position:relative;">
                          <img src="https://www.leadera.com.ar/types-of-real-estate-overview-scaled.jpg" width="252" alt="" style="width:252px; max-width:252px; height:auto; display:block;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td class="mobile-padding" style="padding:27px 28px 31px 28px; background:#ffffff;">

              <!-- WEEK + COMPARISON -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td valign="middle" style="color:#263a36; font-size:14px; line-height:20px; font-weight:500;">
                    Semana del {{week_range}}
                  </td>
                  <td align="right">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#e3efeb; border-radius:10px;">
                      <tr>
                        <td align="center" style="padding:9px 13px 8px;">
                          <div style="color:#0f6e5c; font-size:19px; line-height:21px; font-weight:750;">{{weekly_activity_change}}</div>
                          <div style="color:#60746f; font-size:10px; line-height:14px; padding-top:2px;">vs. semana anterior</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ROW 1 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td class="mobile-stack mobile-card-gap" width="50%" valign="top" style="width:50%; padding-right:6px;">
                    <table role="presentation" class="metric-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#edf8f6; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 18px 17px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="padding-right:12px;">
                                <img src="https://www.leadera.com.ar/icon-phone.png" width="38" height="38" alt="">
                              </td>
                              <td valign="middle">
                                <div style="color:#314a44; font-size:12px; line-height:16px; font-weight:500;">Leads contactados</div>
                                <div style="color:#10211e; font-size:29px; line-height:33px; font-weight:750; padding-top:3px;">{{contacted_leads}}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="color:#0f6e5c; font-size:11px; line-height:15px; font-weight:700; padding-left:50px; padding-top:2px;">{{contacted_leads_change}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="mobile-stack" width="50%" valign="top" style="width:50%; padding-left:6px;">
                    <table role="presentation" class="metric-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#eff9f6; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 18px 17px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="padding-right:12px;">
                                <img src="https://www.leadera.com.ar/icon-person-plus.png" width="38" height="38" alt="">
                              </td>
                              <td valign="middle">
                                <div style="color:#314a44; font-size:12px; line-height:16px; font-weight:500;">Nuevos leads</div>
                                <div style="color:#10211e; font-size:29px; line-height:33px; font-weight:750; padding-top:3px;">{{new_leads}}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="color:#0f6e5c; font-size:11px; line-height:15px; font-weight:700; padding-left:50px; padding-top:2px;">{{new_leads_change}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ROW 2 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td class="mobile-stack mobile-card-gap" width="50%" valign="top" style="width:50%; padding-right:6px;">
                    <table role="presentation" class="metric-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f1f4ff; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 18px 17px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="padding-right:12px;">
                                <img src="https://www.leadera.com.ar/icon-house.png" width="38" height="38" alt="">
                              </td>
                              <td valign="middle">
                                <div style="color:#314a44; font-size:12px; line-height:16px; font-weight:500;">Visitas realizadas</div>
                                <div style="color:#10211e; font-size:29px; line-height:33px; font-weight:750; padding-top:3px;">{{visits_completed}}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="color:#0f6e5c; font-size:11px; line-height:15px; font-weight:700; padding-left:50px; padding-top:2px;">{{visits_change}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="mobile-stack" width="50%" valign="top" style="width:50%; padding-left:6px;">
                    <table role="presentation" class="metric-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#fff4ef; border-radius:12px;">
                      <tr>
                        <td style="padding:18px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="top" style="padding-right:12px;">
                                <img src="https://www.leadera.com.ar/icon-check.png" width="38" height="38" alt="">
                              </td>
                              <td valign="top">
                                <div style="color:#314a44; font-size:12px; line-height:16px; font-weight:500; padding-bottom:6px;">Seguimientos</div>
                                <div style="font-size:18px; line-height:24px; font-weight:750;">
                                  <span style="color:#0f6e5c;">{{followups_completed}}</span>
                                  <span style="color:#ba4731; font-size:12px; font-weight:650;">cumplidos</span>
                                </div>
                                <div style="font-size:18px; line-height:24px; font-weight:750;">
                                  <span style="color:#e13d48;">{{followups_overdue}}</span>
                                  <span style="color:#d34c53; font-size:12px; font-weight:650;">vencidos</span>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- OPERACIONES -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#fff8e9; border-radius:12px; margin-bottom:20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" valign="middle" style="width:44px;">
                          <img src="https://www.leadera.com.ar/icon-barchart.png" width="38" height="38" alt="">
                        </td>
                        <td valign="middle">
                          <div style="color:#314a44; font-size:12px; line-height:16px; font-weight:500;">Operaciones que avanzaron</div>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="color:#10211e; font-size:29px; line-height:34px; font-weight:750; padding-right:14px;">{{operations_advanced}}</td>
                              <td valign="middle">
                                <span style="display:inline-block; background:#e3efeb; color:#0f6e5c; border-radius:20px; padding:4px 8px; font-size:11px; line-height:13px; font-weight:700;">{{operations_change}}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center" bgcolor="#0f6e5c" style="border-radius:9px;">
                    <a href="https://app.leadera.com.ar/mi-dia" target="_blank" style="display:block; padding:16px 24px; color:#ffffff; font-size:14px; line-height:18px; font-weight:650; text-decoration:none;">
                      Ir a LeadEra&nbsp;&nbsp; →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- QUOTE -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f7f8fa; border-radius:12px; margin-bottom:29px;">
                <tr>
                  <td align="center" style="padding:20px 30px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="color:#738983; font-family:Georgia, serif; font-size:26px; line-height:22px; font-weight:700; padding-right:12px;">“</td>
                        <td style="color:#526762; font-size:13px; line-height:19px; font-weight:450;">Disciplina hoy,<br>resultados mañana.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- FOOTER -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <img src="https://www.leadera.com.ar/leadera-logo-icon.png" width="20" height="20" alt="LeadEra">
                        </td>
                        <td valign="middle" style="color:#132622; font-size:17px; line-height:20px; font-weight:750; letter-spacing:-0.4px;">LeadEra</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="color:#82928e; font-size:10px; line-height:15px;">Tu aliado en el crecimiento inmobiliario.</td>
                </tr>
              </table>

            </td>
          </tr>

        </table>

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" style="padding:20px 20px 0; color:#9aa7a3; font-size:10px; line-height:16px;">
              Recibís este email porque activaste el Reporte Semanal en LeadEra.<br>
              <a href="{{unsubscribe_url}}" style="color:#738681; text-decoration:underline;">Darme de baja</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="https://leadera.com.ar" style="color:#738681; text-decoration:underline;">LeadEra</a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
