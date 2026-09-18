import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  IconoAlerta,
  IconoCajas,
  IconoCalendario,
  IconoCasa,
  IconoLapiz,
  IconoLink,
  IconoMail,
  IconoReloj,
  IconoTelefono,
  IconoUsuarios,
} from './Iconos'
import { ICONOS } from './iconosInteraccion'
import { EmailLink, TelefonoConAcciones } from '../comunes/AccionesContacto'
import { TooltipAyuda } from '../comunes/TooltipAyuda'
import { ItemTarea } from '../tareas/ItemTarea'
import { BadgeEstadoOperacion } from '../operaciones/BadgeEstadoOperacion'
import { BadgeEstadoPropiedad } from '../propiedades/BadgeEstadoPropiedad'
import { useAuth } from '../../contexts/AuthContext'
import { useInteraccionesPorLead } from '../../hooks/useInteracciones'
import { useActualizarDescripcion, useNombreAgente } from '../../hooks/useLead'
import { useOperacionesPorLead } from '../../hooks/useOperacion'
import { useBusquedasDeLead } from '../../hooks/useOperaciones'
import { usePropiedadesPorLead } from '../../hooks/usePropiedades'
import {
  useCompletarTarea,
  useDescompletarTarea,
  useEliminarTarea,
  useTareasPorLead,
} from '../../hooks/useTareas'
import { useVisitasDeLead } from '../../hooks/useVisitas'
import { esMomentoPasado } from '../../lib/calendario'
import { formatearFecha } from '../../lib/formatoFecha'
import { etiquetaOrigen, MAX_DESCRIPCION_LEAD } from '../../lib/api/leads'
import { etiquetaTipoInteraccion } from '../../lib/api/interacciones'
import {
  etiquetaTipoOperacion,
  formatearMonto,
  type BusquedaResumida,
  type OperacionConVinculos,
} from '../../lib/api/operaciones'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import type { Interaccion } from '../../lib/api/interacciones'
import type { PropiedadConPropietario } from '../../lib/api/propiedades'
import type { Lead } from '../../lib/api/leads'
import type { Tarea } from '../../types/database'

/**
 * La tabla `busquedas` no tiene columna de moneda —a diferencia de
 * `propiedades` y `operaciones`, que sí la tienen—, así que el rango de precio
 * se muestra en dólares, que es el estándar de precios de LeadEra. Si algún día
 * se agrega la columna, este literal es el único lugar a tocar.
 */
const MONEDA = 'USD'

/** Cuántas filas entran en cada preview antes del "Ver todas". */
const MAX_INTERACCIONES = 5
const MAX_PROPIEDADES = 4
const MAX_OPERACIONES = 3

/** Las tabs a las que puede saltar un "Ver todas →". */
export type TabDestino = 'interacciones' | 'operaciones' | 'propiedades' | 'tareas'

interface ResumenLeadProps {
  /** Ya cargado por `DetalleLead`: no se vuelve a pedir. */
  lead: Lead
  leadId: string
  /**
   * Abre `ModalEditarContacto`. El modal lo monta `DetalleLead`; acá vive el
   * botón que lo dispara, mismo reparto que `onNuevaInteraccion` en las tabs.
   */
  onEditarContacto: () => void
  /** Cambia de tab. Lo resuelve `TabsDetalleLead` con su propio `setActiva`. */
  onIrATab: (tab: TabDestino) => void
}

/**
 * El tablero de la ficha: quién es el lead a la izquierda, en qué anda a la
 * derecha.
 *
 * La columna angosta es la identidad —contacto, descripción, qué busca, estado
 * del seguimiento—: se lee una vez y no cambia seguido. La zona ancha son
 * previews de las tabs de al lado, para no tener que entrar a cada una sólo
 * para ver si hay algo. Cada panel es eso, una preview: la fuente de verdad
 * sigue siendo su tab, y por eso todos —salvo tareas, que no tiene tab— llevan
 * un "Ver todas".
 *
 * Los hooks de las previews son los mismos que ya monta `TabsDetalleLead`, así
 * que comparten la entrada de cache y no hay un request de más por abrir el
 * resumen.
 */
export function ResumenLead({
  lead,
  leadId,
  onEditarContacto,
  onIrATab,
}: ResumenLeadProps) {
  return (
    // En mobile todo apilado, con la identidad primero. En lg la identidad se
    // queda en un tercio y los paneles toman los otros dos.
    // `min-w-0` en las dos zonas: hijas de un grid, su `min-width` es `auto`
    // y en un teléfono se plantaban en el ancho de su contenido en vez de
    // ajustarse a la columna.
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start [&>*]:min-w-0">
      <ColumnaIdentidad
        lead={lead}
        leadId={leadId}
        onEditarContacto={onEditarContacto}
      />

      <div className="space-y-4 lg:col-span-2">
        <PanelInteracciones leadId={leadId} onIrATab={onIrATab} />
        <PanelTareas leadId={leadId} onIrATab={onIrATab} />
        <PanelPropiedades leadId={leadId} onIrATab={onIrATab} />
        <PanelOperaciones leadId={leadId} onIrATab={onIrATab} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Columna angosta: quién es el lead
// ---------------------------------------------------------------------------

function ColumnaIdentidad({
  lead,
  leadId,
  onEditarContacto,
}: {
  lead: Lead
  leadId: string
  onEditarContacto: () => void
}) {
  const busquedas = useBusquedasDeLead(leadId)
  const visitas = useVisitasDeLead(leadId)
  const agente = useNombreAgente(lead.agente_id)

  const filas = busquedas.data ?? []
  // La sección aparece si hay algo que decir: búsquedas, o el estado de la
  // consulta. Con la consulta resuelta y sin filas no se muestra nada, mismo
  // criterio que el origen y las visitas.
  const mostrarBusquedas = busquedas.isPending || busquedas.isError || filas.length > 0

  const proximo = lead.fecha_proximo_seguimiento
  const vencido = proximo != null && esMomentoPasado(proximo)

  const nombreCompleto = `${lead.nombre} ${lead.apellido ?? ''}`.trim()
  const cantidadVisitas = visitas.data ?? 0

  return (
    // Una sola superficie con las secciones separadas por una línea: la
    // identidad es un bloque, no cuatro cards sueltas.
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
      <section className="p-5">
        <Titulo>Información de contacto</Titulo>

        {/* En columna y no en fila: acá el ancho es un tercio de la pantalla y
            los chips uno al lado del otro se partían en cualquier lado. */}
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
            {lead.telefono ? (
              <TelefonoConAcciones
                telefono={lead.telefono}
                nombre={nombreCompleto}
                conIcono
              />
            ) : (
              <>
                <IconoTelefono className="size-4 shrink-0" />
                Sin teléfono
              </>
            )}
          </span>

          {/* Sin email no va nada: mismo criterio que el origen y las visitas.
              El teléfono sí muestra "Sin teléfono" porque es obligatorio y su
              ausencia es un dato. */}
          {lead.email && (
            <span className="flex min-w-0 items-center gap-1.5 text-[0.82rem] text-ink-3">
              <IconoMail className="size-4 shrink-0" />
              <EmailLink email={lead.email} />
            </span>
          )}

          {lead.origen && (
            <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
              <IconoLink className="size-4 shrink-0" />
              {etiquetaOrigen(lead.origen)}
              <TooltipAyuda etiqueta="el origen del lead">
                El origen dice de dónde llegó el lead (Meta Ads, WhatsApp,
                referido…), no si ya lo contactaste. El primer contacto se
                completa solo cuando registrás la primera interacción; hasta
                entonces el lead sigue contando como nuevo.
              </TooltipAyuda>
            </span>
          )}

          <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
            <IconoCalendario className="size-4 shrink-0" />
            Desde {formatearFecha(lead.fecha_ingreso)}
          </span>

          {/* Sin agente asignado, o si el perfil no se pudo leer, no se muestra
              la fila: mismo criterio de ocultar-si-no-hay que el resto. */}
          {agente.data && (
            <span className="flex min-w-0 items-center gap-1.5 text-[0.82rem] text-ink-3">
              <IconoUsuarios className="size-4 shrink-0" />
              <span className="truncate">Asignado a {agente.data}</span>
            </span>
          )}

          {cantidadVisitas > 0 && (
            <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
              <IconoCasa className="size-4 shrink-0" />
              {cantidadVisitas}{' '}
              {cantidadVisitas === 1 ? 'visita realizada' : 'visitas realizadas'}
            </span>
          )}
        </div>

        {/* El modal edita el contacto entero —nombre, apellido, teléfono y
            email—, así que el botón no cuelga de ningún campo en particular. */}
        <button
          type="button"
          onClick={onEditarContacto}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
        >
          <IconoLapiz className="size-4" />
          Editar
        </button>
      </section>

      <SeccionSobreLead lead={lead} />

      {mostrarBusquedas && (
        <section className="border-t border-border p-5">
          <Titulo>Qué busca</Titulo>

          {busquedas.isPending ? (
            <Cargando etiqueta="Cargando búsquedas" />
          ) : busquedas.isError ? (
            <Error>
              {busquedas.error instanceof Error
                ? busquedas.error.message
                : 'No pudimos cargar las búsquedas de este lead.'}
            </Error>
          ) : (
            // Varias búsquedas se apilan separadas por una línea, no en cards
            // sueltas: son variantes de lo mismo, no objetos distintos.
            <div className="divide-y divide-border">
              {filas.map((busqueda) => (
                <Busqueda key={busqueda.id} busqueda={busqueda} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="border-t border-border p-5">
        <Titulo>Seguimiento</Titulo>

        {/* Sin la fila "Ingreso": esa fecha la da la sección de contacto, y
            repetirla acá era decir dos veces lo mismo en la misma pantalla. */}
        <dl className="divide-y divide-border">
          <Fila label="Primer contacto">
            {lead.fecha_primer_contacto_real ? (
              formatearFecha(lead.fecha_primer_contacto_real)
            ) : (
              <span className="text-ink-3 italic">Todavía sin contactar</span>
            )}
          </Fila>

          <Fila label="Último contacto">
            {formatearFecha(lead.fecha_ultimo_contacto_real)}
          </Fila>

          <Fila
            label="Próximo seguimiento"
            ayuda={
              <TooltipAyuda etiqueta="el próximo seguimiento">
                Es la fecha en la que te toca volver a contactarlo. Si la dejás
                sin programar, el lead no aparece en los seguimientos de Mi día.
                Cuando la fecha pasa, salta como prioritario.
              </TooltipAyuda>
            }
          >
            {proximo == null ? (
              <span className="text-ink-3">Sin programar</span>
            ) : vencido ? (
              // Vencido en rojo y con ícono: es el único dato de esta sección
              // que pide una acción, y el color solo no alcanza para quien no
              // lo distingue.
              <span className="inline-flex items-center gap-1.5 font-semibold text-peligro-ink">
                <IconoAlerta className="size-4 shrink-0" />
                {formatearFecha(proximo)}
                <span className="sr-only">(vencido)</span>
              </span>
            ) : (
              formatearFecha(proximo)
            )}
          </Fila>
        </dl>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paneles de la zona ancha
// ---------------------------------------------------------------------------

/**
 * La card de un panel de preview.
 *
 * Mismo contenedor que el resto de la ficha —borde y radio, sin sombra— para
 * que los paneles se lean como parte de la misma superficie y no como tarjetas
 * flotando encima.
 */
function Panel({
  titulo,
  verTodas,
  children,
}: {
  titulo: string
  /** El "Ver todas". Se omite donde no hay a dónde ir. */
  verTodas?: () => void
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-surface p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <Titulo sinMargen>{titulo}</Titulo>
        {verTodas && (
          <button
            type="button"
            onClick={verTodas}
            className="shrink-0 text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
          >
            Ver todas →
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

function PanelInteracciones({
  leadId,
  onIrATab,
}: {
  leadId: string
  onIrATab: (tab: TabDestino) => void
}) {
  // El mismo hook y la misma clave que monta `TabsDetalleLead`: sin request de
  // más, y lo que se registre desde la tab se refleja acá solo.
  const { data, isPending, isError, error } = useInteraccionesPorLead(leadId)

  // `listarInteraccionesPorLead` ya ordena por fecha descendente, así que
  // alcanza con cortar.
  const filas = (data ?? []).slice(0, MAX_INTERACCIONES)

  return (
    <Panel titulo="Últimas interacciones" verTodas={() => onIrATab('interacciones')}>
      {isPending ? (
        <Cargando etiqueta="Cargando interacciones" />
      ) : isError ? (
        <Error>
          {error instanceof Error
            ? error.message
            : 'No pudimos cargar las interacciones.'}
        </Error>
      ) : filas.length === 0 ? (
        <Vacio>Sin interacciones registradas todavía</Vacio>
      ) : (
        <ul className="divide-y divide-border">
          {filas.map((interaccion) => (
            <FilaInteraccion key={interaccion.id} interaccion={interaccion} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Una interacción en modo lectura: sin editar ni eliminar, eso vive en su tab. */
function FilaInteraccion({ interaccion }: { interaccion: Interaccion }) {
  const Icono = ICONOS[interaccion.tipo] ?? IconoReloj

  return (
    <li className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-softer text-primary"
      >
        <Icono className="size-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[0.85rem] font-semibold text-ink-2">
            {etiquetaTipoInteraccion(interaccion.tipo)}
          </span>
          <span className="text-[0.78rem] text-ink-4 tabular-nums">
            {formatearFecha(interaccion.fecha)}
          </span>
        </span>
        {/* Una sola línea: la preview es para saber qué pasó, no para leerlo
            entero. El texto completo está en el timeline de su tab. */}
        <span className="mt-0.5 block truncate text-[0.82rem] text-ink-3">
          {interaccion.detalle || 'Sin detalle'}
        </span>
      </span>
    </li>
  )
}

/**
 * Las tareas del lead, completables desde acá.
 *
 * El "Ver todas" va a la tab de Tareas de esta misma ficha —no al calendario
 * de /tareas, que mezcla las de todos los leads—.
 */
function PanelTareas({
  leadId,
  onIrATab,
}: {
  leadId: string
  onIrATab: (tab: TabDestino) => void
}) {
  const { profile } = useAuth()
  const miId = profile?.id ?? ''

  const { data, isPending, isError, error } = useTareasPorLead(leadId)

  const completar = useCompletarTarea()
  const descompletar = useDescompletarTarea()
  const borrar = useEliminarTarea()

  // Mismo reparto que en /tareas: el estado actual decide cuál de las dos
  // mutaciones se dispara.
  function alternarCompletada(tarea: Tarea) {
    const mutacion = tarea.estado === 'COMPLETADA' ? descompletar : completar
    mutacion.mutate(tarea.id)
  }

  const idCambiando =
    completar.isPending || descompletar.isPending
      ? ((completar.variables ?? descompletar.variables) ?? null)
      : null

  return (
    <Panel titulo="Tareas del lead" verTodas={() => onIrATab('tareas')}>
      {isPending ? (
        <Cargando etiqueta="Cargando tareas" />
      ) : isError ? (
        <Error>
          {error instanceof Error ? error.message : 'No pudimos cargar las tareas.'}
        </Error>
      ) : (data ?? []).length === 0 ? (
        <Vacio>Sin tareas pendientes para este lead</Vacio>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((tarea) => (
            <ItemTarea
              key={tarea.id}
              tarea={tarea}
              miId={miId}
              cambiando={idCambiando === tarea.id}
              eliminando={borrar.isPending && borrar.variables === tarea.id}
              onAlternarCompletada={alternarCompletada}
              onEliminar={(t) => borrar.mutate(t.id)}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function PanelPropiedades({
  leadId,
  onIrATab,
}: {
  leadId: string
  onIrATab: (tab: TabDestino) => void
}) {
  const { data, isPending, isError, error } = usePropiedadesPorLead(leadId)
  const filas = (data ?? []).slice(0, MAX_PROPIEDADES)

  return (
    <Panel titulo="Propiedades relacionadas" verTodas={() => onIrATab('propiedades')}>
      {isPending ? (
        <Cargando etiqueta="Cargando propiedades" />
      ) : isError ? (
        <Error>
          {error instanceof Error
            ? error.message
            : 'No pudimos cargar las propiedades.'}
        </Error>
      ) : filas.length === 0 ? (
        <Vacio>Este lead todavía no figura como propietario de ninguna</Vacio>
      ) : (
        <ul className="divide-y divide-border">
          {filas.map((propiedad) => (
            <FilaPropiedad key={propiedad.id} propiedad={propiedad} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function FilaPropiedad({ propiedad }: { propiedad: PropiedadConPropietario }) {
  const foto = propiedad.fotos_urls?.[0]

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <Link
        to={`/propiedades/${propiedad.id}`}
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {/* Caja de tamaño fijo: la miniatura entra recortada y, sin foto, el
            hueco lo llena el placeholder. La fila mide lo mismo en los dos
            casos, así que una propiedad sin fotos no descuadra la lista. */}
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-ink-4">
          {foto ? (
            <img
              src={foto}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <IconoCasa className="size-6" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.88rem] font-semibold text-ink">
            {propiedad.direccion}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {etiquetaTipo(propiedad.tipo)}
            {propiedad.zona?.trim() && ` · ${propiedad.zona}`}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[0.82rem] font-semibold text-ink tabular-nums">
              {propiedad.precio == null
                ? '—'
                : formatearPrecio(propiedad.precio, propiedad.moneda)}
            </span>
            <BadgeEstadoPropiedad estado={propiedad.estado} />
          </span>
        </span>
      </Link>
    </li>
  )
}

function PanelOperaciones({
  leadId,
  onIrATab,
}: {
  leadId: string
  onIrATab: (tab: TabDestino) => void
}) {
  const { data, isPending, isError, error } = useOperacionesPorLead(leadId)
  const filas = (data ?? []).slice(0, MAX_OPERACIONES)

  return (
    <Panel titulo="Operaciones" verTodas={() => onIrATab('operaciones')}>
      {isPending ? (
        <Cargando etiqueta="Cargando operaciones" />
      ) : isError ? (
        <Error>
          {error instanceof Error
            ? error.message
            : 'No pudimos cargar las operaciones.'}
        </Error>
      ) : filas.length === 0 ? (
        <Vacio>Este lead todavía no tiene operaciones</Vacio>
      ) : (
        <ul className="divide-y divide-border">
          {filas.map((operacion) => (
            <FilaOperacion key={operacion.id} operacion={operacion} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function FilaOperacion({ operacion }: { operacion: OperacionConVinculos }) {
  const tipo = etiquetaTipoOperacion(operacion.tipo)

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <Link
        to={`/operaciones/${operacion.id}`}
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand-softer text-primary"
        >
          <IconoCajas className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          {/* `titulo` es opcional en la tabla; sin él, el tipo es lo único que
              la describe y sube al renglón principal. */}
          <span className="block truncate text-[0.88rem] font-semibold text-ink">
            {operacion.titulo?.trim() || tipo}
          </span>
          <span className="mt-0.5 block text-[0.78rem] text-ink-3">{tipo}</span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[0.82rem] font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatearMonto(operacion.monto, operacion.moneda)}
          </span>
          <span className="mt-1 block">
            <BadgeEstadoOperacion estado={operacion.estado} />
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * "Sobre el lead": la descripción inicial, editable en el lugar.
 *
 * Inline y no en `ModalEditarContacto`: ese modal es el contacto (nombre,
 * teléfono, email) y un texto libre de hasta 500 caracteres lo estiraba
 * para algo que no tiene nada que ver. Acá se edita donde se lee.
 *
 * Antes la sección desaparecía si el campo estaba vacío, y con eso no había
 * forma de cargarla después del alta. Ahora queda siempre, con un "Agregar"
 * cuando no hay nada. Se sobreescribe sin historial, igual que el contacto.
 */
function SeccionSobreLead({ lead }: { lead: Lead }) {
  const guardar = useActualizarDescripcion(lead.id)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const actual = lead.descripcion_inicial?.trim() ?? ''

  function abrir() {
    setBorrador(lead.descripcion_inicial ?? '')
    guardar.reset()
    setEditando(true)
  }

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    guardar.mutate(borrador, { onSuccess: () => setEditando(false) })
  }

  return (
    <section className="border-t border-border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Titulo sinMargen>Sobre el lead</Titulo>
        {!editando && (
          <button
            type="button"
            onClick={abrir}
            aria-label={actual ? 'Editar la descripción del lead' : 'Agregar una descripción del lead'}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78rem] font-semibold text-ink-3 transition-colors hover:bg-background hover:text-ink motion-reduce:transition-none"
          >
            <IconoLapiz className="size-3.5" />
            {actual ? 'Editar' : 'Agregar'}
          </button>
        )}
      </div>

      {editando ? (
        <form onSubmit={manejarSubmit} noValidate>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !guardar.isPending) setEditando(false)
            }}
            rows={4}
            maxLength={MAX_DESCRIPCION_LEAD}
            autoFocus
            aria-label="Descripción del lead"
            placeholder="Ej: Vino referido por Juan. Busca depto de 2 ambientes en zona céntrica."
            className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] leading-relaxed text-ink transition-colors focus:border-primary focus:outline-none motion-reduce:transition-none"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[0.75rem] text-ink-4">
              {borrador.length}/{MAX_DESCRIPCION_LEAD}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={guardar.isPending}
                className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.82rem] font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardar.isPending}
                className="rounded-lg border-none bg-primary px-3 py-1.5 text-[0.82rem] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
          {guardar.isError && (
            <p role="alert" className="mt-2 mb-0 text-[0.82rem] text-peligro-ink">
              {guardar.error instanceof Error
                ? guardar.error.message
                : 'No se pudo guardar la descripción.'}
            </p>
          )}
        </form>
      ) : actual ? (
        <p className="m-0 text-[0.9rem] leading-relaxed whitespace-pre-wrap text-ink-2">
          {lead.descripcion_inicial}
        </p>
      ) : (
        <p className="m-0 text-[0.85rem] text-ink-3 italic">Sin descripción cargada.</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

/** Encabezado de sección o de panel. */
function Titulo({
  children,
  sinMargen = false,
}: {
  children: ReactNode
  /** En los paneles el margen lo pone el `<header>`, que además lleva el link. */
  sinMargen?: boolean
}) {
  return (
    <h3
      className={`m-0 text-xs font-bold tracking-[0.05em] text-primary uppercase ${
        sinMargen ? '' : 'mb-3'
      }`.trim()}
    >
      {children}
    </h3>
  )
}

/** Una fila del `<dl>`: etiqueta a la izquierda, valor a la derecha. */
function Fila({
  label,
  ayuda,
  children,
}: {
  label: string
  /** Un `TooltipAyuda` al lado de la etiqueta. Sólo donde hace falta aclarar. */
  ayuda?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="flex items-center gap-1.5 text-[0.85rem] text-ink-3">
        {label}
        {ayuda}
      </dt>
      <dd className="m-0 text-[0.9rem] text-ink-2 tabular-nums">{children}</dd>
    </div>
  )
}

function Cargando({ etiqueta }: { etiqueta: string }) {
  return (
    <div aria-busy="true" aria-label={etiqueta} className="space-y-2">
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}

function Error({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
    >
      {children}
    </p>
  )
}

/** El vacío de un panel: una línea de texto, sin ilustración ni marco. */
function Vacio({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[0.85rem] text-ink-3">{children}</p>
}

/** Una búsqueda activa: qué tipo, dónde, de qué tamaño y a qué precio. */
function Busqueda({ busqueda }: { busqueda: BusquedaResumida }) {
  const rango = rangoDePrecio(busqueda.precio_min, busqueda.precio_max)

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="m-0 text-[0.9rem] font-semibold text-ink-2">
        {etiquetaTipo(busqueda.tipo_propiedad)}
        {busqueda.zona?.trim() && (
          <span className="font-normal text-ink-3"> · {busqueda.zona}</span>
        )}
      </p>

      {/* Las líneas que no tienen dato no se renderizan: una lista de guiones
          no dice nada sobre lo que el lead busca. */}
      {busqueda.ambientes_min != null && (
        <p className="mt-1 text-[0.85rem] text-ink-3">
          {busqueda.ambientes_min}+ ambientes
        </p>
      )}

      {rango && <p className="mt-1 text-[0.85rem] text-ink-3 tabular-nums">{rango}</p>}

      {busqueda.notas?.trim() && (
        <p className="mt-2 text-[0.85rem] leading-relaxed whitespace-pre-wrap text-ink-2">
          {busqueda.notas}
        </p>
      )}
    </div>
  )
}

/**
 * El rango de precio en texto, o null si la búsqueda no acotó ninguno de los
 * dos extremos.
 *
 * El número lo formatea `formatearPrecio`, la misma función que usa la ficha de
 * la propiedad. Para el extremo derecho del rango se la llama con la moneda
 * vacía: así el separador de miles sale de un solo lugar y no queda un
 * "USD 100.000 - USD 150.000" con la moneda repetida.
 */
function rangoDePrecio(min: number | null, max: number | null): string | null {
  const soloNumero = (valor: number) => formatearPrecio(valor, '').trim()

  if (min != null && max != null) {
    return `${formatearPrecio(min, MONEDA)} - ${soloNumero(max)}`
  }
  if (min != null) return `Desde ${formatearPrecio(min, MONEDA)}`
  if (max != null) return `Hasta ${formatearPrecio(max, MONEDA)}`
  return null
}
