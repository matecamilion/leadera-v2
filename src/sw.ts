/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

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
