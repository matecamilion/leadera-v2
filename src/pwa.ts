import { registerSW } from 'virtual:pwa-register'

/**
 * Registro del service worker.
 *
 * `registerType: 'autoUpdate'` (ver vite.config.ts) hace que una versión nueva
 * tome control sin preguntar; `immediate: true` registra el SW apenas carga el
 * módulo en vez de esperar al evento `load`.
 */
export const updateSW = registerSW({ immediate: true })
