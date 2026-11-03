import type { ReactNode } from 'react'
import {
  CRITERIOS_ORDEN,
  ESTADOS_VISIBLES,
  ETIQUETA_ESTADO,
  hayFiltros,
  type CriterioOrden,
  type EstadoVisible,
  type FiltroPlan,
  type FiltrosCuentas,
} from '../../lib/api/admin'
import {
  DETALLE_PLAN,
  ETIQUETA_METODO,
  PLANES,
  type MetodoCobro,
} from '../../lib/api/suscripcion'
import { SOLIDO_ESTADO } from './estilosEstado'

const CLASES_SELECT =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-cuerpo text-ink transition-colors focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none motion-reduce:transition-none'

function Selector({
  id,
  etiqueta,
  valor,
  onCambio,
  children,
}: {
  id: string
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-meta font-semibold text-ink-3">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)} className={CLASES_SELECT}>
        {children}
      </select>
    </div>
  )
}

/**
 * Búsqueda, filtros y orden del listado de cuentas. No guarda nada: recibe los
 * valores y avisa qué cambió; quien la usa los lleva a la URL.
 */
export function BarraDeFiltrosCuentas({
  filtros,
  orden,
  conteos,
  noClientes,
  resultados,
  total,
  onCambiar,
  onOrden,
  onLimpiar,
}: {
  filtros: FiltrosCuentas
  orden: CriterioOrden
  /** Cuentas de cada estado, con los demás filtros aplicados. */
  conteos: Record<EstadoVisible, number>
  /** Cuántas cuentas internas o de testing hay. Con cero, no se ofrece el toggle. */
  noClientes: number
  resultados: number
  total: number
  onCambiar: (cambios: Partial<FiltrosCuentas>) => void
  onOrden: (orden: CriterioOrden) => void
  onLimpiar: () => void
}) {
  function alternarEstado(estado: EstadoVisible) {
    const estados = filtros.estados.includes(estado)
      ? filtros.estados.filter((e) => e !== estado)
      : [...filtros.estados, estado]
    onCambiar({ estados })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="buscar-cuentas" className="sr-only">
          Buscar por inmobiliaria, dueño o email
        </label>
        <input
          id="buscar-cuentas"
          type="search"
          value={filtros.texto}
          onChange={(e) => onCambiar({ texto: e.target.value })}
          placeholder="Buscar por inmobiliaria, dueño o email"
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-cuerpo text-ink transition-colors placeholder:text-ink-3 focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none motion-reduce:transition-none"
        />
      </div>

      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS_VISIBLES.map((estado) => {
          const activo = filtros.estados.includes(estado)
          return (
            <button
              key={estado}
              type="button"
              aria-pressed={activo}
              onClick={() => alternarEstado(estado)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                activo
                  ? 'border-primary bg-brand-soft text-primary'
                  : 'border-border bg-surface text-ink-2 hover:border-ink-subtle'
              }`}
            >
              <span aria-hidden className={`size-2 rounded-full ${SOLIDO_ESTADO[estado]}`} />
              {ETIQUETA_ESTADO[estado]}
              <span className="text-ink-3 tabular-nums">{conteos[estado]}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Selector
          id="filtro-plan"
          etiqueta="Plan"
          valor={filtros.plan ?? ''}
          onCambio={(v) => onCambiar({ plan: v === '' ? null : (v as FiltroPlan) })}
        >
          <option value="">Todos los planes</option>
          {PLANES.map((p) => (
            <option key={p} value={p}>
              {DETALLE_PLAN[p].nombre}
            </option>
          ))}
          <option value="SIN_PLAN">Sin plan</option>
        </Selector>

        <Selector
          id="filtro-metodo"
          etiqueta="Método de cobro"
          valor={filtros.metodo ?? ''}
          onCambio={(v) => onCambiar({ metodo: v === '' ? null : (v as MetodoCobro) })}
        >
          <option value="">Todos los métodos</option>
          {(Object.keys(ETIQUETA_METODO) as MetodoCobro[]).map((m) => (
            <option key={m} value={m}>
              {ETIQUETA_METODO[m]}
            </option>
          ))}
        </Selector>

        <Selector
          id="orden-cuentas"
          etiqueta="Ordenar por"
          valor={orden}
          onCambio={(v) => onOrden(v as CriterioOrden)}
        >
          {CRITERIOS_ORDEN.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </Selector>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p role="status" className="m-0 text-cuerpo font-semibold text-ink tabular-nums">
          {resultados} de {total} {total === 1 ? 'cuenta' : 'cuentas'}
        </p>

        {noClientes > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-cuerpo text-ink-3">
            <input
              type="checkbox"
              checked={filtros.incluirInternas}
              onChange={(e) => onCambiar({ incluirInternas: e.target.checked })}
              className="size-4 accent-primary"
            />
            Mostrar internas y testing ({noClientes})
          </label>
        )}

        {hayFiltros(filtros) && (
          <button
            type="button"
            onClick={onLimpiar}
            className="ml-auto rounded-md px-2 py-1 text-cuerpo font-semibold text-primary transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
