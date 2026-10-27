import { Link } from 'react-router-dom'
import { IconoMas, IconoPersonaMas } from './Iconos'

/** La invitación de una cuenta sin ningún lead: la misma en Mi día y en Leads. */
export function EstadoSinLeads() {
  return (
    <div className="mb-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-primary"
      >
        <IconoPersonaMas className="size-6" />
      </span>
      <h2 className="m-0 text-[1.05rem] font-bold text-ink">Todavía no cargaste ningún lead</h2>
      <p className="mt-1.5 text-[0.9rem] text-ink-3">Con nombre y teléfono ya podés empezar.</p>
      <Link
        to="/leads/nuevo"
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark motion-reduce:transition-none"
      >
        <IconoMas className="size-5" />
        Cargar mi primer lead
      </Link>
      <p className="mt-3 mb-0">
        <Link
          to="/leads/importar"
          className="inline-flex min-h-11 items-center rounded-md text-[0.85rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Importar desde Excel
        </Link>
      </p>
    </div>
  )
}
