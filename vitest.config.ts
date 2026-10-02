import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Tests de componentes (`npm test`). Config aparte de vite.config.ts para no
 * arrastrar el plugin de la PWA a los tests.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
