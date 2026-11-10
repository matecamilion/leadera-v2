/**
 * El botón secundario de la ficha del lead: borde fino, fondo de superficie, sin
 * mayúsculas. Lo comparten el encabezado y las pestañas. Sin `flex-1`: cada uso
 * decide cómo se reparte el ancho.
 */
export const CLASES_ACCION_SECUNDARIA = [
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg',
  'border border-border bg-surface px-3.5 py-2',
  'text-[0.82rem] font-semibold whitespace-nowrap text-ink',
  'transition-colors hover:bg-background sm:min-h-10 motion-reduce:transition-none',
].join(' ')

/** El enlace de texto con el color de marca, para las acciones que navegan. */
export const CLASES_ENLACE_ACCION =
  'inline-flex items-center gap-1.5 rounded-md text-cuerpo font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
