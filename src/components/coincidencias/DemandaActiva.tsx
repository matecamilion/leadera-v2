import type { DemandaActiva as Demanda } from '../../lib/api/busquedas'
import { etiquetaTipo, type TipoPropiedad } from '../../lib/api/propiedades'

/** Cuántas zonas se muestran como atajo. */
const ZONAS_VISIBLES = 6

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

interface DemandaActivaProps {
  demanda: Demanda
  onElegirTipo: (tipo: TipoPropiedad) => void
  onElegirZona: (zona: string) => void
}

/**
 * El estado inicial de Coincidencias: qué se está buscando hoy en la cartera.
 *
 * En vez de una caja vacía, un panorama de la demanda y atajos para arrancar:
 * tocar un tipo o una zona lo carga en la barra y busca.
 */
export function DemandaActiva({ demanda, onElegirTipo, onElegirZona }: DemandaActivaProps) {
  if (demanda.total === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-surface px-6 py-12 text-center">
        <p className="m-0 text-[1.05rem] font-semibold text-ink">Todavía no hay búsquedas activas</p>
        <p className="mx-auto mt-2 mb-0 max-w-lg text-[0.9rem] text-ink-3">
          Las búsquedas se cargan con los criterios de una operación de compra o de búsqueda de
          alquiler, o llegan solas cuando aceptás una consulta del link público. Cuando haya,
          acá vas a ver a quién le sirve lo que tengas para ofrecer.
        </p>
      </div>
    )
  }

  const zonas = demanda.zonas.slice(0, ZONAS_VISIBLES)

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 sm:p-6">
      <p className="m-0 text-[1.15rem] font-bold text-ink">
        Tenés {demanda.total} {demanda.total === 1 ? 'búsqueda activa' : 'búsquedas activas'}
      </p>
      <p className="mt-1 mb-0 text-[0.9rem] text-ink-3">
        Cargá arriba lo que tenés para ofrecer, o arrancá por lo que más se busca.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="m-0 mb-2.5 text-[0.8rem] font-bold tracking-[0.04em] text-ink-3 uppercase">
            Por tipo de propiedad
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {demanda.porTipo.map(({ tipo, cantidad }) => (
              <li key={tipo ?? 'cualquiera'}>
                {tipo ? (
                  <button type="button" onClick={() => onElegirTipo(tipo)} className={CHIP}>
                    {etiquetaTipo(tipo)}
                    <Cantidad n={cantidad} />
                  </button>
                ) : (
                  // "Cualquier tipo" no es un criterio que se pueda cargar: va sin botón.
                  <span className={`${CHIP} pointer-events-none`}>
                    Cualquier tipo
                    <Cantidad n={cantidad} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="m-0 mb-2.5 text-[0.8rem] font-bold tracking-[0.04em] text-ink-3 uppercase">
            Zonas más buscadas
          </h2>
          {zonas.length === 0 ? (
            <p className="m-0 text-[0.9rem] text-ink-3">Ninguna búsqueda tiene zona cargada.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {zonas.map(({ zona, cantidad }) => (
                <li key={zona}>
                  <button type="button" onClick={() => onElegirZona(zona)} className={CHIP}>
                    {zona}
                    <Cantidad n={cantidad} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Cantidad({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-brand-soft px-1.5 text-[0.75rem] font-bold text-primary tabular-nums">
      {n}
    </span>
  )
}
