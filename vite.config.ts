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
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
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
      // El service worker es src/sw.ts (ver ahí qué hace). El plugin sólo le
      // inyecta la lista de precache y lo publica como /sw.js, la misma URL de
      // siempre: así quienes tienen el worker anterior se actualizan en el lugar.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // App shell: precacheamos todo el bundle estático.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // El chunk de la ficha PDF pesa ~1.2 MB: precachearlo haría que TODOS
        // se lo bajen en la primera visita, que es justo lo que el React.lazy
        // trataba de evitar. Queda fuera del precache y se baja recién cuando
        // alguien abre el detalle de una propiedad.
        // La serif de "Crear imagen" tampoco: sólo la usa ese panel.
        globIgnores: ['**/BotonExportarFicha-*.js', '**/exceljs*.js', '**/playfair-display-*.woff2', '**/email/**'],
      },
      devOptions: {
        // Habilitar sólo para depurar el SW en local; ver README.
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
