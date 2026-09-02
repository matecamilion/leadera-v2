/**
 * Lockup de marca: el isotipo (la "L" del favicon) más el nombre.
 * Hereda el color del contenedor para funcionar sobre claro y sobre el sidebar.
 */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 64 64"
        aria-hidden
        className="shrink-0"
      >
        <rect width="64" height="64" rx="14" fill="currentColor" opacity="0.16" />
        <path d="M20 14h9v27h17v9H20z" fill="currentColor" />
      </svg>
      <span className="text-base font-semibold tracking-tight">LeadEra</span>
    </span>
  )
}
