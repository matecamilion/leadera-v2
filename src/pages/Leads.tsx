import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { BuscadorLeads } from '../components/leads/BuscadorLeads'
import { FiltrosChips, type ValorFiltro } from '../components/leads/FiltrosChips'
import { FiltroRolChips } from '../components/leads/FiltroRolChips'
import { IconoMas, IconoTabla } from '../components/leads/Iconos'
import { LeadsCards } from '../components/leads/LeadsCards'
import { LeadsTabla } from '../components/leads/LeadsTabla'
import { ModalEliminarLead } from '../components/leads/ModalEliminarLead'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { Paginacion } from '../components/leads/Paginacion'
import { OPCIONES_ORDEN, SelectorOrdenLeads } from '../components/leads/SelectorOrdenLeads'
import { LEADS_POR_PAGINA, useLeads, useTotalLeads } from '../hooks/useLeads'
import {
  useInteraccionesPorLead,
  useOperacionesPorLead,
  useRolesPorLead,
} from '../hooks/useOperacionesPorLead'
import {
  eliminarLead,
  listarLeadsParaExportar,
  type FiltroDelDia,
  type FiltroEstado,
  type Lead,
  type OrdenLeads,
} from '../lib/api/leads'
import { FILTROS_ROL, etiquetaFiltroRol, type FiltroRol } from '../lib/api/rolLead'
import { EstadoError, BotonError } from '../components/comunes/EstadoError'
import { esPaginaFueraDeRango, mensajeDeListado } from '../lib/mensajesDeError'
import { leerPagina } from '../lib/parametrosDeUrl'
import { claves } from '../lib/queryKeys'
import { useUiStore } from '../stores/ui'

/** Los valores de `?estado=` que entiende el listado. */
const FILTROS_VALIDOS: FiltroEstado[] = [
  'CALIENTE',
  'TIBIO',
  'FRIO',
  'INACTIVO',
  'GANADO',
  'nuevos',
]

/** Los valores de `?filtro=`: los cortes de Mi día que no son un estado. */
const FILTROS_DEL_DIA: FiltroDelDia[] = ['prioritarios', 'seguimientos']

/** Lo que se agrega al contador para que se sepa qué se está viendo. */
const ETIQUETA_DEL_DIA: Record<FiltroDelDia, string> = {
  prioritarios: 'prioritarios de hoy',
  seguimientos: 'con seguimiento para hoy',
}

/** Los valores de `?orden=`. `prioridad` es el default y no se escribe. */
const ORDENES_VALIDOS: OrdenLeads[] = OPCIONES_ORDEN.map((o) => o.valor)

const CLAVE_ORDEN = 'leadera.leads.orden'

/**
 * El último orden elegido, para cuando la URL no trae uno. En try/catch por lo
 * mismo que `TarjetaSemanaGestion`: en incógnito o con el sitio bloqueado
 * `localStorage` tira, y eso no puede romper el listado.
 */
function leerOrdenGuardado(): OrdenLeads | undefined {
  try {
    const valor = localStorage.getItem(CLAVE_ORDEN)
    return ORDENES_VALIDOS.find((o) => o === valor)
  } catch {
    return undefined
  }
}

function guardarOrden(orden: OrdenLeads): void {
  try {
    localStorage.setItem(CLAVE_ORDEN, orden)
  } catch {
    // La próxima vez arranca en prioridad. Es molesto, no roto.
  }
}

export default function Leads() {
  // Filtro, búsqueda y página viven en la URL, no en estado local: así
  // sobreviven a entrar a una ficha y volver con el botón atrás, aguantan un
  // F5 y se pueden pasar por chat tal como se están viendo. Antes esto era
  // `useState` y `?estado=` se leía una sola vez, al montar.
  //
  // No hay que forzar que los tres estén siempre: lo que falta cae en su
  // default (sin filtro, sin búsqueda, página 1).
  const [searchParams, setSearchParams] = useSearchParams()
  const filtroEstado = FILTROS_VALIDOS.find((f) => f === searchParams.get('estado'))
  const filtroDelDia = FILTROS_DEL_DIA.find((f) => f === searchParams.get('filtro'))
  const filtroRol = FILTROS_ROL.find((f) => f === searchParams.get('rol'))
  const busqueda = searchParams.get('q') ?? ''
  const page = leerPagina(searchParams.get('page'))

  // La URL manda; si no trae orden, el último elegido; si tampoco, prioridad.
  // El guardado va en estado para que elegir "Prioridad" —que no se escribe en
  // la URL— se vea al instante y no recién al recargar.
  const [ordenGuardado, setOrdenGuardado] = useState(leerOrdenGuardado)
  const orden =
    ORDENES_VALIDOS.find((o) => o === searchParams.get('orden')) ?? ordenGuardado ?? 'prioridad'

  const [leadAEliminar, setLeadAEliminar] = useState<Lead | null>(null)
  // Sobre qué lead se está registrando una interacción. El lead entero y no el
  // id: el modal muestra el nombre en el subtítulo.
  const [leadARegistrar, setLeadARegistrar] = useState<Lead | null>(null)
  const [exportando, setExportando] = useState(false)
  const [avisoExport, setAvisoExport] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const { data, isPending, isError, error } = useLeads(
    filtroEstado,
    busqueda,
    page,
    filtroDelDia,
    filtroRol,
    orden,
  )
  const { data: total } = useTotalLeads(busqueda, filtroRol)

  const leads = useMemo(() => data?.data ?? [], [data])
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads])

  const operaciones = useOperacionesPorLead(leadIds)
  const interacciones = useInteraccionesPorLead(leadIds)
  const roles = useRolesPorLead(leadIds)

  const borrado = useMutation({
    mutationFn: (id: string) => eliminarLead(id),
    onSuccess: () => {
      setLeadAEliminar(null)
      // Invalidamos todo lo que cuelga de 'leads': el listado, el total del
      // chip "Todos" y los conteos de la página actual.
      queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
    },
  })

  const totalPaginas = Math.max(1, Math.ceil((data?.count ?? 0) / LEADS_POR_PAGINA))
  const cantidad = data?.count ?? 0

  /**
   * Exporta lo que el usuario está viendo, no la base entera: van el mismo
   * filtro de estado y la misma búsqueda que tiene aplicados. Lo que sí
   * cambia es que salen todos los resultados y no sólo la página actual.
   *
   * Sólo `exportarExcel` se importa acá adentro —y con él `xlsx`, que pesa
   * medio mega—. `listarLeadsParaExportar` va estático: vive en un módulo que
   * esta página ya carga igual, así que traerlo aparte no ahorraría nada y
   * encima le rompe el chunking al bundler.
   */
  async function exportar() {
    setExportando(true)
    setAvisoExport(null)
    try {
      const paraExportar = await listarLeadsParaExportar({
        estado: filtroEstado,
        delDia: filtroDelDia,
        rol: filtroRol,
        busqueda,
        orden,
      })

      if (paraExportar.length === 0) {
        // Un .xlsx con sólo los encabezados se abre y no dice nada; es peor
        // que no descargar nada.
        setAvisoExport('No hay leads que coincidan con el filtro, así que no se generó el archivo.')
        return
      }

      const { generarExcelLeads } = await import('../lib/exportarExcel')
      await generarExcelLeads(paraExportar)
      setAvisoExport(
        `Se exportaron ${paraExportar.length} ${paraExportar.length === 1 ? 'lead' : 'leads'}.`,
      )
    } catch (e) {
      setAvisoExport(
        e instanceof Error ? e.message : 'No pudimos generar el Excel. Probá de nuevo.',
      )
    } finally {
      setExportando(false)
    }
  }

  /**
   * Escribe los tres parámetros de una.
   *
   * Van juntos porque tocar uno puede tener que pisar otro: mover el filtro o
   * la búsqueda vuelve a la página 1, ya que con menos resultados la página en
   * la que estabas puede no existir más y la lista quedaría vacía sin
   * explicación.
   *
   * Lo que está en su valor por defecto no se escribe: la URL de "todos, sin
   * buscar, página 1" es `/leads` pelada y no `/leads?estado=&q=&page=1`.
   *
   * `?filtro=` (el corte de Mi día) sobrevive a buscar y a paginar, pero se va
   * al tocar un chip: elegir una temperatura es salir de ese corte.
   *
   * Va con `replace` a propósito. Ajustar un filtro no es una navegación que
   * uno quiera deshacer: con `push`, salir del listado después de probar cinco
   * chips serían seis "atrás", y el debounce del buscador dejaría un escalón
   * por cada pausa al tipear. El push que importa lo hace la navegación a la
   * ficha, que es justo la que el botón atrás tiene que deshacer.
   */
  function escribirFiltros(
    estado: FiltroEstado | undefined,
    texto: string,
    pagina: number,
    salirDelCorte = false,
  ) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)

        if (estado) proximos.set('estado', estado)
        else proximos.delete('estado')

        if (salirDelCorte) proximos.delete('filtro')

        if (texto) proximos.set('q', texto)
        else proximos.delete('q')

        if (pagina > 1) proximos.set('page', String(pagina))
        else proximos.delete('page')

        return proximos
      },
      { replace: true },
    )
  }

  function cambiarFiltro(valor: ValorFiltro) {
    // Cualquier chip, "Todos" incluido: con el corte activo ninguno está
    // encendido, así que tocar uno siempre es pedir otra cosa.
    escribirFiltros(valor, busqueda, 1, true)
  }

  /**
   * El rol es un eje aparte: se suma a la temperatura, a la búsqueda y al
   * corte de Mi día en vez de reemplazarlos. Sólo vuelve a la página 1, por lo
   * mismo que `escribirFiltros`.
   */
  function cambiarRol(valor: FiltroRol | undefined) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)
        if (valor) proximos.set('rol', valor)
        else proximos.delete('rol')
        proximos.delete('page')
        return proximos
      },
      { replace: true },
    )
  }

  /**
   * Mismo trato que el rol: va a la URL con `replace`, `prioridad` no se
   * escribe y se vuelve a la página 1 —la página 3 de otro orden es otra gente—.
   * Además queda guardado como el orden de la próxima visita.
   */
  function cambiarOrden(valor: OrdenLeads) {
    guardarOrden(valor)
    setOrdenGuardado(valor)
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)
        if (valor === 'prioridad') proximos.delete('orden')
        else proximos.set('orden', valor)
        proximos.delete('page')
        return proximos
      },
      { replace: true },
    )
  }

  function cambiarBusqueda(valor: string) {
    escribirFiltros(filtroEstado, valor, 1)
  }

  function cambiarPagina(valor: number) {
    escribirFiltros(filtroEstado, busqueda, valor)
  }

  // En un corte de Mi día el orden es el de la sección y no se elige (ver
  // `aplicarOrden`): un selector que no hace nada confunde.
  const selectorOrden = !filtroDelDia && (
    <SelectorOrdenLeads valor={orden} onCambiar={cambiarOrden} />
  )

  return (
    <div className="mx-auto max-w-[1200px] text-ink">
      <header className="mb-4 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Gestión de leads
          </p>
          <h1 className="m-0 text-[2rem] leading-tight font-bold text-ink">
            Todos los leads
          </h1>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-ink">
              {cantidad} {cantidad === 1 ? 'lead encontrado' : 'leads encontrados'}
              {filtroDelDia && ` · ${ETIQUETA_DEL_DIA[filtroDelDia]}`}
              {filtroRol && ` · ${etiquetaFiltroRol(filtroRol)}`}
            </span>
            {/* Mobile: Ordenar va junto al contador. Desktop: en la fila de filtros. */}
            {selectorOrden && <div className="shrink-0 md:hidden">{selectorOrden}</div>}
          </div>
        </div>

        {/* En mobile buscador y "+" comparten fila y Exportar se oculta: el menú
            Crear del header ya ofrece "Nuevo lead" y exportar es de escritorio. */}
        <div className="flex w-full flex-row items-center gap-3 md:w-auto md:justify-end">
          <BuscadorLeads valor={busqueda} onCambiar={cambiarBusqueda} />

          <Link
            to="/leads/nuevo"
            className="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary p-0 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark md:size-auto md:px-[18px] md:py-2.5 motion-reduce:transition-none"
          >
            <IconoMas className="size-5" />
            <span className="sr-only md:not-sr-only">Nuevo Lead</span>
          </Link>

          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            title="Exporta los leads que coinciden con el filtro y la búsqueda actuales"
            className="hidden items-center justify-center gap-2 rounded-md border border-border bg-surface px-[18px] md:inline-flex py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
          >
            <IconoTabla className="size-5 text-excel" />
            {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
      </header>

      {avisoExport && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[0.85rem] text-ink-2"
        >
          {avisoExport}
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* En mobile los chips no entran en una fila: scrollean y el degradé avisa
            que hay más. El padding derecho deja al último salir de debajo. */}
        <div className="relative min-w-0 max-md:[&>nav]:pr-10">
          <FiltrosChips
            valor={filtroDelDia ?? filtroEstado}
            onCambiar={cambiarFiltro}
            total={total}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background from-25% to-transparent md:hidden"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectorOrden && <div className="hidden md:contents">{selectorOrden}</div>}
          <FiltroRolChips valor={filtroRol} onCambiar={cambiarRol} />
        </div>
      </div>

      {filtroRol === 'compradores' && (
        <p className="-mt-2 mb-5 text-right text-[0.85rem]">
          <Link
            to="/coincidencias"
            className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Buscar compradores para algo que tengas →
          </Link>
        </p>
      )}

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <EstadoError
          titulo="No pudimos cargar los leads"
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
          {/* Desktop: la tabla va dentro de su card blanca */}
          <div className="hidden rounded-[16px] border border-border bg-surface p-5 md:block">
            <LeadsTabla
              leads={leads}
              ultimaInteraccion={(id) => interacciones(id).ultimoDetalle}
              rol={roles}
              onRegistrar={setLeadARegistrar}
              onEliminar={setLeadAEliminar}
            />
          </div>

          <div className="md:hidden">
            <LeadsCards
              leads={leads}
              operaciones={operaciones}
              interacciones={interacciones}
              rol={roles}
              onRegistrar={setLeadARegistrar}
              onEliminar={setLeadAEliminar}
            />
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

      {/* Montado sólo con un lead elegido, para que el formulario arranque
          limpio en cada apertura. Al guardar cierra y nada más: el filtro, la
          búsqueda y la página siguen intactos porque nunca se navegó, y la fila
          se actualiza sola con las invalidaciones de `useCrearInteraccion`. */}
      {leadARegistrar && (
        <ModalNuevaInteraccion
          abierto
          leadId={leadARegistrar.id}
          nombreLead={`${leadARegistrar.nombre} ${leadARegistrar.apellido ?? ''}`.trim()}
          onCerrar={() => setLeadARegistrar(null)}
          onCreada={() => mostrarAviso('Interacción registrada.')}
        />
      )}

      <ModalEliminarLead
        abierto={leadAEliminar !== null}
        nombreLead={leadAEliminar?.nombre ?? ''}
        eliminando={borrado.isPending}
        error={borrado.error instanceof Error ? borrado.error.message : null}
        onCancelar={() => {
          borrado.reset()
          setLeadAEliminar(null)
        }}
        onConfirmar={() => leadAEliminar && borrado.mutate(leadAEliminar.id)}
      />
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando leads"
      className="space-y-4 md:space-y-0 md:rounded-[16px] md:border md:border-border md:bg-surface md:p-5"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-[16px] bg-surface-2 md:h-14 md:rounded-md motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
