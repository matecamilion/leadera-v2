import { registerSW } from 'virtual:pwa-register'
import { capturarInstalacion } from './lib/instalarApp'

/**
 * El link público de consultas (`/c/:slug`) lo abre gente que no usa la app,
 * casi siempre desde el celular. Registrar el SW ahí le haría bajar en segundo
 * plano el precache entero del CRM (~1,3 MB) con sus datos móviles, para nada.
 */
function esConsultaPublica(): boolean {
  return window.location.pathname.startsWith('/c/')
}

/**
 * Registro del service worker.
 *
 * `registerType: 'autoUpdate'` (ver vite.config.ts) hace que una versión nueva
 * tome control sin preguntar; `immediate: true` registra el SW apenas carga el
 * módulo en vez de esperar al evento `load`.
 */
export const updateSW = esConsultaPublica() ? null : registerSW({ immediate: true })

// `beforeinstallprompt` se dispara una sola vez y temprano: se captura acá, al
// arrancar, para tenerlo cuando el usuario abra el menú. Mismo criterio que el SW.
if (!esConsultaPublica()) capturarInstalacion()
