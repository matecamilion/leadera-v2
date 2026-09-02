import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro lo hacemos a mano en src/pwa.ts para poder pasar `immediate: true`.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'LeadEra',
        short_name: 'LeadEra',
        description: 'CRM inmobiliario LeadEra',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7F8FA',
        theme_color: '#0F6E5C',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: precacheamos todo el bundle estático y servimos index.html
        // para cualquier ruta del SPA que no matchee un archivo.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // El chunk de la ficha PDF pesa ~1.2 MB: precachearlo haría que TODOS
        // se lo bajen en la primera visita, que es justo lo que el React.lazy
        // trataba de evitar. Queda fuera del precache y se baja recién cuando
        // alguien abre el detalle de una propiedad.
        globIgnores: ['**/BotonExportarFicha-*.js', '**/exceljs*.js'],
        navigateFallback: '/index.html',
        // Nunca devolver el shell cacheado para llamadas a la API.
        navigateFallbackDenylist: [/^\/api\//, /\/auth\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Deliberadamente NO cacheamos respuestas de Supabase: son datos de CRM
        // por usuario y autenticados. Se resuelve con cache en memoria (Fase 1+).
      },
      devOptions: {
        // Habilitar sólo para depurar el SW en local; ver README.
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
