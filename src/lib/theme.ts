/**
 * Espejo en TypeScript de los design tokens definidos en src/index.css (@theme).
 *
 * Regla: los componentes usan utilidades de Tailwind (bg-primary, text-ink-muted).
 * Este módulo existe sólo para los casos donde hace falta el valor desde JS:
 * meta theme-color, canvas/gráficos, librerías de terceros que piden un hex.
 *
 * Si cambiás un color acá, cambialo también en index.css. index.css manda.
 */

export const colors = {
  primary: '#0F6E5C',
  primaryHover: '#0C5A4B',
  primaryActive: '#094639',
  primarySoft: '#E6F2EF',
  primaryContrast: '#FFFFFF',

  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F5',
  border: '#E3E6EA',

  ink: '#1A1F24',
  inkMuted: '#5B6570',
  inkSubtle: '#8B949E',

  success: '#2E7D5B',
  warning: '#B7791F',
  danger: '#C0392B',
  info: '#2C6FB5',
} as const

export const fonts = {
  sans: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
} as const

/** Valor usado por <meta name="theme-color"> y por el manifest de la PWA. */
export const THEME_COLOR = colors.primary

export type ColorToken = keyof typeof colors
