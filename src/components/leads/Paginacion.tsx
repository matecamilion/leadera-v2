interface PaginacionProps {
  page: number
  totalPaginas: number
  onCambiar: (page: number) => void
}

export function Paginacion({ page, totalPaginas, onCambiar }: PaginacionProps) {
  if (totalPaginas <= 1) return null

  return (
    <nav
      aria-label="Paginación de leads"
      className="flex items-center justify-between gap-4"
    >
      <p aria-live="polite" className="text-[0.85rem] text-ink-3">
        Página {page} de {totalPaginas}
      </p>

      <div className="flex gap-2">
        <Boton
          label="Anterior"
          disabled={page <= 1}
          onClick={() => onCambiar(page - 1)}
        />
        <Boton
          label="Siguiente"
          disabled={page >= totalPaginas}
          onClick={() => onCambiar(page + 1)}
        />
      </div>
    </nav>
  )
}

function Boton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface motion-reduce:transition-none"
    >
      {label}
    </button>
  )
}
