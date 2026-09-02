import { Link, useSearchParams } from 'react-router-dom'
import { Paginacion } from '../components/leads/Paginacion'
import {
  FiltrosPropiedades,
  type RangosPropiedad,
} from '../components/propiedades/FiltrosPropiedades'
import { PropiedadesCards } from '../components/propiedades/PropiedadesCards'
import { PropiedadesTabla } from '../components/propiedades/PropiedadesTabla'
import { PROPIEDADES_POR_PAGINA, usePropiedades } from '../hooks/usePropiedades'
import {
  ESTADOS_PROPIEDAD,
  TIPOS_PROPIEDAD,
  type EstadoPropiedad,
  type TipoPropiedad,
} from '../lib/api/propiedades'
import { EstadoError, BotonError } from '../components/comunes/EstadoError'
import { esPaginaFueraDeRango, mensajeDeListado } from '../lib/mensajesDeError'
import { leerNumeroPositivo, leerPagina } from '../lib/parametrosDeUrl'

/**
 * `?estado=` saneado.
 *
 * Se valida contra `ESTADOS_PROPIEDAD` en vez de contra una lista propia, así
 * agregar un estado al enum no deja acá una copia desactualizada. Cualquier
 * otra cosa cae en `undefined`, que es "todos los estados".
 */
function leerEstado(valor: string | null): EstadoPropiedad | undefined {
  return ESTADOS_PROPIEDAD.find((e) => e.valor === valor)?.valor
}

/** `?tipo=` saneado, mismo criterio: contra el catálogo, no contra una copia. */
function leerTipo(valor: string | null): TipoPropiedad | undefined {
  return TIPOS_PROPIEDAD.find((t) => t.valor === valor)?.valor
}

export default function Propiedades() {
  // Estado, búsqueda y página viven en la URL, no en estado local: así
  // sobreviven a entrar a una propiedad y volver con el botón atrás, aguantan
  // un F5 y se pueden pasar por chat tal como se están viendo. Mismo esquema
  // que el listado de Leads.
  //
  // No hay que forzar que los tres estén siempre: lo que falta cae en su
  // default (sin filtro, sin búsqueda, página 1).
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

  /**
   * Escribe todos los parámetros de una.
   *
   * Van juntos porque tocar uno puede tener que pisar otro: mover cualquier
   * filtro vuelve a la página 1, ya que con menos resultados la página en la
   * que estabas puede no existir más y la lista quedaría vacía sin explicación.
   *
   * Lo que está en su valor por defecto no se escribe: la URL de "sin filtros,
   * sin buscar, página 1" es `/propiedades` pelada. Los rangos numéricos
   * llegan ya saneados desde el componente de filtros, así que un `undefined`
   * acá significa "sacá el parámetro".
   *
   * Va con `replace` a propósito. Ajustar un filtro no es una navegación que
   * uno quiera deshacer: con `push`, salir del listado después de probar cinco
   * estados serían seis "atrás", y el debounce del buscador dejaría un escalón
   * por cada pausa al tipear. El push que importa lo hace la navegación a la
   * ficha, que es justo la que el botón atrás tiene que deshacer.
   */
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
        // La 1 es el default y no se escribe.
        escribir('page', cambios.pagina > 1 ? cambios.pagina : undefined)

        return proximos
      },
      { replace: true },
    )
  }

  /** Lo que hay ahora, para que cada handler pise sólo lo suyo. */
  const actuales = { estado, busqueda, tipo, rangos, pagina: 1 }

  function cambiarEstado(valor: EstadoPropiedad | undefined) {
    escribirFiltros({ ...actuales, estado: valor })
  }

  function cambiarBusqueda(valor: string) {
    escribirFiltros({ ...actuales, busqueda: valor })
  }

  function cambiarTipo(valor: TipoPropiedad | undefined) {
    escribirFiltros({ ...actuales, tipo: valor })
  }

  function cambiarRangos(valor: RangosPropiedad) {
    escribirFiltros({ ...actuales, rangos: valor })
  }

  /**
   * Borra tipo y rangos en una sola escritura.
   *
   * Existe porque llamar a `cambiarTipo` y `cambiarRangos` seguidos no
   * funciona: los dos parten del mismo `actuales` y el segundo repone el tipo
   * que el primero acababa de sacar. El estado y la búsqueda no se tocan, que
   * son los filtros de la fila de arriba.
   */
  function limpiarAvanzados() {
    escribirFiltros({
      ...actuales,
      tipo: undefined,
      rangos: { precioMin: undefined, precioMax: undefined, ambientesMin: undefined },
    })
  }

  function cambiarPagina(valor: number) {
    escribirFiltros({ ...actuales, pagina: valor })
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Propiedades
          </p>
          <h1 className="m-0 text-[1.6rem] font-bold text-ink">Propiedades</h1>
          <p className="mt-1 text-[0.92rem] text-ink-3">
            {total === 1 ? '1 propiedad' : `${total} propiedades`} en tu cartera.
          </p>
        </div>

        <Link
          to="/propiedades/nueva"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
        >
          + Nueva Propiedad
        </Link>
      </header>

      <div className="mb-5">
        <FiltrosPropiedades
          busqueda={busqueda}
          onBusqueda={cambiarBusqueda}
          estado={estado}
          onEstado={cambiarEstado}
          tipo={tipo}
          onTipo={cambiarTipo}
          rangos={rangos}
          onRangos={cambiarRangos}
          onLimpiarAvanzados={limpiarAvanzados}
        />
      </div>

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <EstadoError
          titulo="No pudimos cargar las propiedades"
          mensaje={mensajeDeListado(error)}
          accion={
            // Salida para el `?page=` fuera de rango: sin esto hay que editar
            // la URL a mano, porque la lista no llega a renderizarse y con ella
            // se va la paginación. Sólo para ese error —una caída de red no se
            // arregla yendo a la página 1—.
            page > 1 && esPaginaFueraDeRango(error) ? (
              <BotonError onClick={() => cambiarPagina(1)}>
                Volver a la primera página
              </BotonError>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* El vacío reemplaza a la grilla, no a todo el bloque: la paginación
              tiene que sobrevivirlo. Con un `?page=` que se fue de rango —un
              filtro que ahora tiene menos páginas que antes— la lista queda
              vacía y "Anterior" es la única forma de volver a una con datos.
              Mismo orden de render que el listado de Leads, donde el vacío vive
              adentro de la tabla y la paginación queda afuera. */}
          {propiedades.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
              No hay propiedades para mostrar.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <PropiedadesTabla propiedades={propiedades} />
              </div>
              <div className="md:hidden">
                <PropiedadesCards propiedades={propiedades} />
              </div>
            </>
          )}

          <div className="mt-5">
            <Paginacion
              page={page}
              totalPaginas={totalPaginas}
              onCambiar={cambiarPagina}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando propiedades"
      className="space-y-3 md:space-y-0 md:rounded-xl md:border md:border-border md:bg-surface md:p-3"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-surface-2 md:h-12 md:rounded-md motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
