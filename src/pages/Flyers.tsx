import { Link, useSearchParams } from 'react-router-dom'
import { Paginacion } from '../components/leads/Paginacion'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { FiltrosPropiedades, type RangosPropiedad } from '../components/propiedades/FiltrosPropiedades'
import { FOTOS_PARA_FLYER } from '../components/propiedades/imagen/constantes'
import { PROPIEDADES_POR_PAGINA, usePropiedades } from '../hooks/usePropiedades'
import {
  ESTADOS_PROPIEDAD,
  TIPOS_PROPIEDAD,
  etiquetaTipo,
  formatearPrecio,
  type EstadoPropiedad,
  type PropiedadConPropietario,
  type TipoPropiedad,
} from '../lib/api/propiedades'
import { esPaginaFueraDeRango, mensajeDeListado } from '../lib/mensajesDeError'
import { leerNumeroPositivo, leerPagina } from '../lib/parametrosDeUrl'

/** Mismo saneado de la URL que `Propiedades.tsx`: contra el catálogo, no contra una copia. */
function leerEstado(valor: string | null): EstadoPropiedad | undefined {
  return ESTADOS_PROPIEDAD.find((e) => e.valor === valor)?.valor
}

function leerTipo(valor: string | null): TipoPropiedad | undefined {
  return TIPOS_PROPIEDAD.find((t) => t.valor === valor)?.valor
}

/** Elegir la propiedad de la que se arma el flyer. Los filtros viven en la URL, como en Propiedades. */
export default function Flyers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const estado = leerEstado(searchParams.get('estado'))
  const busqueda = searchParams.get('q') ?? ''
  const tipo = leerTipo(searchParams.get('tipo'))
  const rangos: RangosPropiedad = {
    precioMin: leerNumeroPositivo(searchParams.get('precioMin')),
    precioMax: leerNumeroPositivo(searchParams.get('precioMax')),
    ambientesMin: leerNumeroPositivo(searchParams.get('ambientesMin')),
  }
  const page = leerPagina(searchParams.get('page'))

  const { data, isPending, isError, error } = usePropiedades(
    { estado, busqueda, tipo, ...rangos },
    page,
  )

  const propiedades = data?.data ?? []
  const total = data?.count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / PROPIEDADES_POR_PAGINA))

  /** Con `replace`, como en Propiedades: ajustar un filtro no es una navegación para deshacer. */
  function escribirFiltros(cambios: {
    estado: EstadoPropiedad | undefined
    busqueda: string
    tipo: TipoPropiedad | undefined
    rangos: RangosPropiedad
    pagina: number
  }) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)
        const escribir = (clave: string, valor: string | number | undefined) => {
          if (valor === undefined || valor === '') proximos.delete(clave)
          else proximos.set(clave, String(valor))
        }
        escribir('estado', cambios.estado)
        escribir('q', cambios.busqueda)
        escribir('tipo', cambios.tipo)
        escribir('precioMin', cambios.rangos.precioMin)
        escribir('precioMax', cambios.rangos.precioMax)
        escribir('ambientesMin', cambios.rangos.ambientesMin)
        escribir('page', cambios.pagina > 1 ? cambios.pagina : undefined)
        return proximos
      },
      { replace: true },
    )
  }

  // Cualquier cambio de filtro vuelve a la página 1.
  const actuales = { estado, busqueda, tipo, rangos, pagina: 1 }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6">
        <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Flyers
        </p>
        <h1 className="m-0 text-[1.6rem] font-bold text-ink">Crear flyer</h1>
        <p className="mt-1 text-[0.92rem] text-ink-3">
          Elegí la propiedad. El flyer sale listo para Instagram y no se guarda.
        </p>
      </header>

      <div className="mb-5">
        <FiltrosPropiedades
          busqueda={busqueda}
          onBusqueda={(v) => escribirFiltros({ ...actuales, busqueda: v })}
          estado={estado}
          onEstado={(v) => escribirFiltros({ ...actuales, estado: v })}
          tipo={tipo}
          onTipo={(v) => escribirFiltros({ ...actuales, tipo: v })}
          rangos={rangos}
          onRangos={(v) => escribirFiltros({ ...actuales, rangos: v })}
          // Una sola escritura: dos seguidas se pisan (ver FiltrosPropiedades).
          onLimpiarAvanzados={() =>
            escribirFiltros({
              ...actuales,
              tipo: undefined,
              rangos: { precioMin: undefined, precioMax: undefined, ambientesMin: undefined },
            })
          }
        />
      </div>

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <EstadoError
          titulo="No pudimos cargar las propiedades"
          mensaje={mensajeDeListado(error)}
          accion={
            page > 1 && esPaginaFueraDeRango(error) ? (
              <BotonError onClick={() => escribirFiltros({ ...actuales, pagina: 1 })}>
                Volver a la primera página
              </BotonError>
            ) : undefined
          }
        />
      ) : (
        <>
          {propiedades.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
              No hay propiedades para mostrar.
            </p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 xl:grid-cols-4">
              {propiedades.map((p) => (
                <li key={p.id}>
                  <TarjetaFlyer propiedad={p} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <Paginacion
              page={page}
              totalPaginas={totalPaginas}
              onCambiar={(pagina) => escribirFiltros({ ...actuales, pagina })}
            />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaFlyer({ propiedad: p }: { propiedad: PropiedadConPropietario }) {
  const fotos = p.fotos_urls ?? []
  const alcanza = fotos.length >= FOTOS_PARA_FLYER

  const contenido = (
    <>
      <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2">
        {fotos[0] && (
          <img src={fotos[0]} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="px-3.5 py-3">
        <p className="m-0 truncate text-[0.88rem] font-bold text-ink">
          {etiquetaTipo(p.tipo)}
          {p.zona ? ` · ${p.zona}` : ''}
        </p>
        <p className="m-0 mt-0.5 text-[0.88rem] text-ink-2 tabular-nums">
          {p.precio == null ? 'Precio a consultar' : formatearPrecio(p.precio, p.moneda)}
        </p>
        {!alcanza && (
          <p className="m-0 mt-1.5 text-[0.78rem] text-ink-3">
            Cargá al menos {FOTOS_PARA_FLYER} fotos para crear el flyer
          </p>
        )}
      </div>
    </>
  )

  const clases = 'block overflow-hidden rounded-[16px] border border-border bg-surface'

  // Sin fotos suficientes no es un link: se ve, pero no lleva a ningún lado.
  if (!alcanza) return <div className={`${clases} opacity-60`}>{contenido}</div>

  return (
    <Link
      to={`/flyers/${p.id}`}
      className={`${clases} transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none`}
    >
      {contenido}
    </Link>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando propiedades"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
