/**
 * Lockup de marca: el isotipo "Cuadrante" (cuatro rombos girados 45°, uno
 * atenuado) más el nombre.
 *
 * La geometría es la misma de public/favicon.svg, pero acá los rombos usan
 * `currentColor` en vez del primario fijo: el lockup se monta sobre el sidebar
 * oscuro (en blanco) y sobre fondo claro (en primario), y el color plano del
 * SVG original no sobreviviría al primero. El wordmark va como texto HTML para
 * que herede Inter, la tipografía de la app.
 */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 48 48"
        aria-hidden
        className="shrink-0"
      >
        <g transform="rotate(45 24 24)" fill="currentColor">
          <path d="M9 12.5 A3.5 3.5 0 0 1 12.5 9 H22 V22 H9 Z" />
          <path d="M9 26 H22 V39 H12.5 A3.5 3.5 0 0 1 9 35.5 Z" />
          <path d="M26 26 H35.5 A3.5 3.5 0 0 1 39 29.5 V39 H26 Z" />
          <path d="M26 9 H35.5 A3.5 3.5 0 0 1 39 12.5 V22 H26 Z" opacity="0.32" />
        </g>
      </svg>
      <span className="text-base font-semibold tracking-tight">LeadEra</span>
    </span>
  )
}
