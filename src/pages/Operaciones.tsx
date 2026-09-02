import { Link, useSearchParams } from 'react-router-dom'
import { EstadoError, BotonError } from '../components/comunes/EstadoError'
import { Paginacion } from '../components/leads/Paginacion'
import { AlternadorVista } from '../components/operaciones/AlternadorVista'
import { BuscadorOperaciones } from '../components/operaciones/BuscadorOperaciones'
import { FiltrosOperaciones } from '../components/operaciones/FiltrosOperaciones'
import { OperacionesCards } from '../components/operaciones/OperacionesCards'
import { OperacionesTabla } from '../components/operaciones/OperacionesTabla'
import { OPERACIONES_POR_PAGINA, useOperaciones } from '../hooks/useOperaciones'
import {
  ESTADOS_OPERACION,
  TIPOS_OPERACION,
  type EstadoOperacion,
  type TipoOperacion,
} from '../lib/api/operaciones'
import { esPaginaFueraDeRango, mensajeDeListado } from '../lib/mensajesDeError'
import { leerPagina } from '../lib/parametrosDeUrl'

/**
 * `?tipo=` y `?estado=` saneados contra sus catálogos.
 *
 * Se validan contra `TIPOS_OPERACION` / `ESTADOS_OPERACION` y no contra listas
 * propias, así agregar un valor al enum no deja acá una copia desactualizada.
 * Cualquier otra cosa cae en `undefined`, que es "todos".
 */
function leerTipo(valor: string | null): TipoOperacion | undefined {
  return TIPOS_OPERACION.find((t) => t.valor === valor)?.valor
}

function leerEstado(valor: string | null): EstadoOperacion | undefined {
  return ESTADOS_OPERACION.find((e) => e.valor === valor)?.valor
}

export default function Operaciones() {
  // Tipo, estado, búsqueda y página viven en la URL, no en estado local: así
  // sobreviven a entrar a una operación y volver con el botón atrás, aguantan
  // un F5 y se pueden pasar por chat tal como se están viendo. Mismo esquema
  // que Leads y Propiedades.
  //
  // El "Ver todas" del tablero ya linkeaba acá con `?estado=X`, pero eso se
  // leía una sola vez al montar y a partir de ahí la URL quedaba mintiendo.
  // Ahora la URL es la fuente de verdad y ese link sigue funcionando igual.
  const [searchParams, setSearchParams] = useSearchParams()
  const tipo = leerTipo(searchParams.get('tipo'))
  const estado = leerEstado(searchParams.get('estado'))
  const busqueda = searchParams.get('q') ?? ''
  const page = leerPagina(searchParams.get('page'))

  const { data, isPending, isError, error } = useOperaciones(tipo, estado, busqueda, page)

  const operaciones = data?.data ?? []
  const total = data?.count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / OPERACIONES_POR_PAGINA))

  /**
   * Escribe los cuatro parámetros de una.
   *
   * Van juntos porque tocar uno puede tener que pisar otro: mover tipo, estado
   * o búsqueda vuelve a la página 1, ya que con menos resultados la página en
   * la que estabas puede no existir más y la tabla quedaría vacía sin
   * explicación.
   *
   * Lo que está en su valor por defecto no se escribe: la URL de "todo, sin
   * buscar, página 1" es `/operaciones` pelada.
   *
   * Va con `replace` a propósito. Ajustar un filtro no es una navegación que
   * uno quiera deshacer: con `push`, salir del listado después de probar cinco
   * estados serían seis "atrás", y el debounce del buscador dejaría un escalón
   * por cada pausa al tipear. El push que importa lo hace la navegación a la
   * ficha, que es justo la que el botón atrás tiene que deshacer.
   */
  function escribirFiltros(
    valorTipo: TipoOperacion | undefined,
    valorEstado: EstadoOperacion | undefined,
    texto: string,
    pagina: number,
  ) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)

        if (valorTipo) proximos.set('tipo', valorTipo)
        else proximos.delete('tipo')

        if (valorEstado) proximos.set('estado', valorEstado)
        else proximos.delete('estado')

        if (texto) proximos.set('q', texto)
        else proximos.delete('q')

        if (pagina > 1) proximos.set('page', String(pagina))
        else proximos.delete('page')

        return proximos
      },
      { replace: true },
    )
  }

  function cambiarTipo(valor: TipoOperacion | undefined) {
    escribirFiltros(valor, estado, busqueda, 1)
  }

  function cambiarEstado(valor: EstadoOperacion | undefined) {
    escribirFiltros(tipo, valor, busqueda, 1)
  }

  function cambiarBusqueda(valor: string) {
    escribirFiltros(tipo, estado, valor, 1)
  }

  function cambiarPagina(valor: number) {
    escribirFiltros(tipo, estado, busqueda, valor)
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Pipeline
          </p>
          <h1 className="m-0 text-[1.6rem] font-bold text-ink">Operaciones</h1>
          <p className="mt-1 text-[0.92rem] text-ink-3">
            {/* Con un filtro o una búsqueda activa el número ya no es "lo que
                hay registrado" sino "lo que coincide": el texto lo dice. */}
            {busqueda || tipo || estado
              ? total === 1
                ? '1 operación encontrada'
                : `${total} operaciones encontradas`
              : total === 1
                ? '1 operación registrada'
                : `${total} operaciones registradas`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AlternadorVista actual="lista" />
          <Link
            to="/operaciones/nueva"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
          >
            + Nueva Operación
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <BuscadorOperaciones valor={busqueda} onCambiar={cambiarBusqueda} />

        <FiltrosOperaciones
          tipo={tipo}
          onTipo={cambiarTipo}
          estado={estado}
          onEstado={cambiarEstado}
        />
      </div>

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <EstadoError
          titulo="No pudimos cargar las operaciones"
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
      ) : operaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
          <h3 className="mb-1.5 font-semibold text-ink-2">Sin operaciones</h3>
          <p className="text-[0.9rem]">
            {busqueda
              ? `No hay operaciones que coincidan con "${busqueda}".`
              : 'No hay operaciones que coincidan con los filtros.'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <OperacionesTabla operaciones={operaciones} />
          </div>
          <div className="md:hidden">
            <OperacionesCards operaciones={operaciones} />
          </div>

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
      aria-label="Cargando operaciones"
      className="space-y-3 md:space-y-0 md:rounded-xl md:border md:border-border md:bg-surface md:p-3"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-surface-2 md:h-12 md:rounded-md motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
