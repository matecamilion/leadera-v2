import { esMesFuturo, mesAnterior, mesSiguiente, nombreDelMes } from '../../lib/mes'

interface SelectorMesProps {
  /** El mes mostrado, `YYYY-MM`. */
  mes: string
  onCambiar: (mes: string) => void
  /** El último mes al que se puede ir, `YYYY-MM`. */
  tope: string
}

/** Mismo navegador de mes que el calendario de Tareas: ‹ nombre ›. */
export function SelectorMes({ mes, onCambiar, tope }: SelectorMesProps) {
  const siguiente = mesSiguiente(mes)

  return (
    <div className="flex items-center gap-1">
      <BotonMes etiqueta="Mes anterior" onClick={() => onCambiar(mesAnterior(mes))}>
        ‹
      </BotonMes>
      <span
        // `capitalize` pondría "Octubre De 2026": sólo va la primera letra.
        className="min-w-[10rem] text-center text-[0.95rem] font-bold text-ink first-letter:uppercase"
      >
        {nombreDelMes(mes, true)}
      </span>
      <BotonMes
        etiqueta="Mes siguiente"
        onClick={() => onCambiar(siguiente)}
        deshabilitado={esMesFuturo(siguiente, tope)}
      >
        ›
      </BotonMes>
    </div>
  )
}

function BotonMes({
  etiqueta,
  onClick,
  deshabilitado,
  children,
}: {
  etiqueta: string
  onClick: () => void
  deshabilitado?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface text-[1.1rem] text-ink-2 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}
