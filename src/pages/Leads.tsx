import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { BuscadorLeads } from '../components/leads/BuscadorLeads'
import { FiltrosChips, type ValorFiltro } from '../components/leads/FiltrosChips'
import { IconoMas, IconoTabla } from '../components/leads/Iconos'
import { LeadsCards } from '../components/leads/LeadsCards'
import { LeadsTabla } from '../components/leads/LeadsTabla'
import { ModalEliminarLead } from '../components/leads/ModalEliminarLead'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { Paginacion } from '../components/leads/Paginacion'
import { LEADS_POR_PAGINA, useLeads, useTotalLeads } from '../hooks/useLeads'
import {
  useInteraccionesPorLead,
  useOperacionesPorLead,
} from '../hooks/useOperacionesPorLead'
import {
  eliminarLead,
  listarLeadsParaExportar,
  type FiltroEstado,
  type Lead,
} from '../lib/api/leads'
import { EstadoError, BotonError } from '../components/comunes/EstadoError'
import { esPaginaFueraDeRango, mensajeDeListado } from '../lib/mensajesDeError'
import { leerPagina } from '../lib/parametrosDeUrl'
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
  const busqueda = searchParams.get('q') ?? ''
  const page = leerPagina(searchParams.get('page'))

  const [leadAEliminar, setLeadAEliminar] = useState<Lead | null>(null)
  // Sobre qué lead se está registrando una interacción. El lead entero y no el
  // id: el modal muestra el nombre en el subtítulo.
  const [leadARegistrar, setLeadARegistrar] = useState<Lead | null>(null)
  const [exportando, setExportando] = useState(false)
  const [avisoExport, setAvisoExport] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const { data, isPending, isError, error } = useLeads(filtroEstado, busqueda, page)
  const { data: total } = useTotalLeads(busqueda)

  const leads = useMemo(() => data?.data ?? [], [data])
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads])

  const operaciones = useOperacionesPorLead(leadIds)
  const interacciones = useInteraccionesPorLead(leadIds)

  const borrado = useMutation({
    mutationFn: (id: string) => eliminarLead(id),
    onSuccess: () => {
      setLeadAEliminar(null)
      // Invalidamos todo lo que cuelga de 'leads': el listado, el total del
      // chip "Todos" y los conteos de la página actual.
      queryClient.invalidateQueries({ queryKey: ['leads'] })
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
        busqueda,
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
  ) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)

        if (estado) proximos.set('estado', estado)
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

  function cambiarFiltro(valor: ValorFiltro) {
    escribirFiltros(valor, busqueda, 1)
  }

  function cambiarBusqueda(valor: string) {
    escribirFiltros(filtroEstado, valor, 1)
  }

  function cambiarPagina(valor: number) {
    escribirFiltros(filtroEstado, busqueda, valor)
  }

  return (
    <div className="mx-auto max-w-[1200px] text-ink">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Gestión de leads
          </p>
          <h1 className="m-0 text-[2rem] leading-tight font-bold text-ink">
            Todos los leads
          </h1>
          <span className="text-ink">
            {cantidad} {cantidad === 1 ? 'lead encontrado' : 'leads encontrados'}
          </span>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end">
          <BuscadorLeads valor={busqueda} onCambiar={cambiarBusqueda} />

          <Link
            to="/leads/nuevo"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
          >
            <IconoMas className="size-5" />
            Nuevo Lead
          </Link>

          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            title="Exporta los leads que coinciden con el filtro y la búsqueda actuales"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
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

      <div className="mb-5">
        <FiltrosChips valor={filtroEstado} onCambiar={cambiarFiltro} total={total} />
      </div>

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
              onRegistrar={setLeadARegistrar}
              onEliminar={setLeadAEliminar}
            />
          </div>

          <div className="md:hidden">
            <LeadsCards
              leads={leads}
              operaciones={operaciones}
              interacciones={interacciones}
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
