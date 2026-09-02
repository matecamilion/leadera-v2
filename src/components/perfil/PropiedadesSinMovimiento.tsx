import { Link } from 'react-router-dom'
import { IconoCasa } from '../leads/Iconos'
import { DIAS_SIN_MOVIMIENTO, type PropiedadFrenada } from '../../lib/api/perfil'

/** Cuántas se listan antes del "y N más". */
const VISIBLES = 5

/**
 * Propiedades disponibles que hace rato nadie toca. Es una lista y no un
 * número porque el número solo no dice sobre cuál hay que actuar.
 */
export function PropiedadesSinMovimiento({
  propiedades,
}: {
  propiedades: PropiedadFrenada[]
}) {
  const visibles = propiedades.slice(0, VISIBLES)
  const resto = propiedades.length - visibles.length

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Sin movimiento</h2>
        {propiedades.length > 0 && (
          <span className="rounded-full bg-warm-soft px-2.5 py-0.5 text-[0.72rem] font-bold text-badge-tibio-ink">
            {propiedades.length}
          </span>
        )}
      </header>

      {propiedades.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.85rem] text-ink-3">
          Todo tu portfolio tiene actividad reciente.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[0.8rem] text-ink-3">
            Disponibles y sin tocar hace más de {DIAS_SIN_MOVIMIENTO} días
          </p>

          <ul className="flex flex-col">
            {visibles.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/propiedades/${p.id}`}
                  className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand-softer text-primary"
                  >
                    <IconoCasa className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.85rem] text-ink-2">
                    {p.direccion}
                  </span>
                  <span className="shrink-0 text-[0.78rem] font-semibold whitespace-nowrap text-badge-tibio-ink tabular-nums">
                    {p.diasSinMovimiento} días
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {resto > 0 && (
            <Link
              to="/propiedades"
              className="mt-2 inline-block text-[0.82rem] font-semibold text-primary hover:underline"
            >
              y {resto} más →
            </Link>
          )}
        </>
      )}
    </section>
  )
}
