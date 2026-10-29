import type { FilaDetalle } from './resumenResultado'

/** Filas que se muestran por lista; el resto se resume en "y N más". */
export const MAX_FILAS_VISIBLES = 50

interface ListaDetalleProps {
  titulo: string
  filas: FilaDetalle[]
  tono?: 'neutro' | 'aviso' | 'error'
}

const COLOR_MOTIVO = {
  neutro: 'text-ink-2',
  aviso: 'text-badge-tibio-ink',
  error: 'text-peligro-ink',
}

/**
 * Detalle desplegable de una categoría. Sin filas no se dibuja.
 *
 * Muestra lo que dice el archivo del usuario (fila, nombre) y un motivo: nunca
 * datos de un lead que ya esté en la cuenta.
 */
export function ListaDetalle({ titulo, filas, tono = 'neutro' }: ListaDetalleProps) {
  if (filas.length === 0) return null

  const visibles = filas.slice(0, MAX_FILAS_VISIBLES)
  const restantes = filas.length - visibles.length

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3.5 py-2 text-[0.88rem] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          {titulo} <span className="font-normal text-ink-3 tabular-nums">({filas.length.toLocaleString('es-AR')})</span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      {/* El scroll es de este contenedor: la página nunca se ensancha. */}
      <div className="max-w-full overflow-x-auto border-t border-border">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[0.82rem]">
          <thead>
            <tr className="bg-surface-2 text-ink-2">
              <th scope="col" className="px-3 py-2 text-xs font-bold whitespace-nowrap">
                Fila
              </th>
              <th scope="col" className="px-3 py-2 text-xs font-bold whitespace-nowrap">
                Nombre
              </th>
              <th scope="col" className="px-3 py-2 text-xs font-bold whitespace-nowrap">
                Motivo
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) => (
              <tr key={`${f.fila}-${i}`} className="border-t border-border align-top text-ink">
                <td className="px-3 py-2 text-ink-3 tabular-nums">{f.fila}</td>
                <td className="px-3 py-2">{f.nombre || '—'}</td>
                <td className={`min-w-[14rem] px-3 py-2 ${COLOR_MOTIVO[tono]}`}>
                  {f.motivo}
                  {f.descripcion && (
                    <details className="mt-1.5">
                      <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-md text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        Ver descripción final
                      </summary>
                      <pre className="mt-1.5 mb-0 max-h-48 max-w-[34rem] overflow-auto rounded-md border border-border bg-surface-2 p-2.5 font-sans text-xs whitespace-pre-wrap text-ink-2">
                        {f.descripcion}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {restantes > 0 && (
          <p className="m-0 border-t border-border px-3 py-2 text-xs text-ink-3">
            y {restantes.toLocaleString('es-AR')} más
          </p>
        )}
      </div>
    </details>
  )
}
