/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { normalizarPayloadPush, resolverUrlInterna } from './lib/pushPayload'

/**
 * Service worker de LeadEra. Hace lo mismo que el que generaba vite-plugin-pwa
 * con `generateSW`: app shell precacheado y fallback al index.html para las
 * rutas del SPA. Las respuestas de Supabase no se cachean (son datos de CRM
 * autenticados y por usuario).
 *
 * Se escribe a mano para poder sumarle handlers propios; el tipado de worker
 * vive en `tsconfig.sw.json`, aparte del de la app (que usa la lib DOM).
 */
declare const self: ServiceWorkerGlobalScope

// La lista la inyecta vite-plugin-pwa en el build (ver `injectManifest` en vite.config.ts).
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Una versión nueva toma control sin esperar a que se cierren las pestañas.
void self.skipWaiting()
clientsClaim()

// Nunca devolver el shell cacheado para llamadas a la API ni a auth.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /\/auth\//],
  }),
)

// Web Push. El navegador exige mostrar una notificación por cada push, así que
// ante un payload inválido se muestra la genérica de LeadEra.
self.addEventListener('push', (event) => {
  const payload = normalizarPayloadPush(event.data?.text() ?? null)
  const url = resolverUrlInterna(payload.url, self.location.origin)
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // No se confía en lo guardado: se vuelve a validar al hacer click.
  const guardada: unknown = (event.notification.data as { url?: unknown } | null)?.url
  const url = resolverUrlInterna(typeof guardada === 'string' ? guardada : '/', self.location.origin)

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const ventana = ventanas[0]
      if (!ventana) {
        await self.clients.openWindow(url)
        return
      }
      await ventana.focus()
      const actual = new URL(ventana.url)
      if (actual.pathname + actual.search + actual.hash !== url) {
        try {
          await ventana.navigate(url)
        } catch {
          await self.clients.openWindow(url)
        }
      }
    })(),
  )
})
