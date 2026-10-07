import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useDetalleGestion, useResumenGestion } from '../../hooks/useModeloGestion'
import type { EstadoLead } from '../../lib/api/leads'
import type { TipoInteraccion } from '../../lib/api/interacciones'
import type { FilaDetalleGestion, MetricaGestion, PeriodoGestion, ResumenGestion } from '../../lib/api/modeloGestion'
import {
  agruparPorDia,
  calcularDesglose,
  esPeriodoActual,
  etiquetaDia,
  etiquetaDiaLarga,
  etiquetaPeriodo,
  META_DIARIA_VERDES,
  METRICAS,
  presentarFila,
  referenciaSiguiente,
  sumarDias,
  type EstadoPanel,
} from '../../lib/detalleGestion'
import { calcularRitmo, hoyEnArgentina, type Ritmo } from '../../lib/ritmoSemanal'
import { BotonError, EstadoError } from '../comunes/EstadoError'
import { AvatarLead } from '../leads/AvatarLead'
import { IconoCasa, IconoCerrar, IconoFlechaAtras, IconoPersonaMas } from '../leads/Iconos'
import { ICONOS } from '../leads/iconosInteraccion'
import { AnilloProgreso } from './AnilloProgreso'

interface PanelDetalleGestionProps {
  /** Lo que pide la URL. Null = cerrado. */
  estado: EstadoPanel | null
  onCerrar: () => void
  /** Otro período de la misma métrica. Null = el período en curso. */
  onCambiarReferencia: (referencia: string | null) => void
}

/**
 * Escritorio: panel fijo a la derecha. Mobile (<640px): hoja a pantalla
 * completa. Entra deslizando con `@starting-style` (desde abajo en mobile,
 * desde la derecha en escritorio); con movimiento reducido aparece sin más.
 *
 * `m-0 ml-auto`: el preflight le saca el margen al `<dialog>` y lo deja pegado
 * a la izquierda; con `ml-auto` queda contra el borde derecho. `max-*-none`
 * pisa el tope que el navegador le pone a un `<dialog>` modal.
 */
const CLASES_DIALOG = [
  'm-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-hidden border-none bg-surface p-0 text-left shadow-modal',
  'sm:w-[440px] sm:rounded-l-[20px]',
  'backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]',
  'transition-transform duration-300 ease-out motion-reduce:transition-none',
  'starting:translate-y-full sm:starting:translate-y-0 sm:starting:translate-x-full',
].join(' ')

const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * El detalle de un anillo del modelo de gestión: el número, su desglose y la
 * lista de lo que suma, por día.
 *
 * Mismo patrón que los modales de la app: `<dialog>` nativo con `showModal()`,
 * que da el foco atrapado, la capa superior (por encima del header sticky) y
 * el Escape. El estado abierto vive en la URL; esto sólo lo refleja.
 */
export function PanelDetalleGestion({ estado, onCerrar, onCambiarReferencia }: PanelDetalleGestionProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const idTitulo = useId()
  const abierto = estado !== null

  // Un cierre por apertura. Escape, el fondo, el botón y el cierre forzado del
  // navegador pueden llegar juntos; pedirlo dos veces sería un `navigate(-1)`
  // de más y sacaría al usuario de Mi día.
  const cerrando = useRef(false)
  function pedirCierre() {
    if (cerrando.current) return
    cerrando.current = true
    onCerrar()
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto) cerrando.current = false
    if (abierto && !dialog.open) {
      dialog.showModal()
      // `showModal` enfoca el primer foco posible; se fija en cerrar para que
      // no dependa del orden del header.
      cerrarRef.current?.focus()
    }
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  // El `<dialog>` modal no frena el scroll del documento: sin esto, en iOS Mi
  // día se mueve por debajo al deslizar la lista.
  useEffect(() => {
    if (!abierto) return
    const raiz = document.documentElement
    const previo = raiz.style.overflow
    raiz.style.overflow = 'hidden'
    return () => {
      raiz.style.overflow = previo
    }
  }, [abierto])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      // El Escape del <dialog> cierra sin avisar al padre: se intercepta para
      // que el cierre pase por la URL y el estado no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        pedirCierre()
      }}
      // Chrome ignora el preventDefault de un segundo Escape seguido y cierra
      // igual. Si el diálogo se cerró solo y la URL todavía lo tiene abierto,
      // se pide el cierre para no quedar desincronizados. Cuando lo cierra el
      // efecto de arriba, `abierto` ya es false y esto no hace nada.
      onClose={() => {
        if (abierto) pedirCierre()
      }}
      // Un click en el fondo llega con el `<dialog>` como target: el
      // contenido lo tapa entero, así que un click adentro nunca cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget) pedirCierre()
      }}
      className={CLASES_DIALOG}
    >
      {estado && (
        <Contenido
          estado={estado}
          idTitulo={idTitulo}
          cerrarRef={cerrarRef}
          onCerrar={pedirCierre}
          onCambiarReferencia={onCambiarReferencia}
        />
      )}
    </dialog>
  )
}

function Contenido({
  estado,
  idTitulo,
  cerrarRef,
  onCerrar,
  onCambiarReferencia,
}: {
  estado: EstadoPanel
  idTitulo: string
  cerrarRef: RefObject<HTMLButtonElement | null>
  onCerrar: () => void
  onCambiarReferencia: (referencia: string | null) => void
}) {
  const { metrica, periodo, referencia } = estado
  const hoy = hoyEnArgentina()

  const resumen = useResumenGestion(periodo, true, referencia)
  // En Día, prelistings y contactos nuevos no tienen meta diaria: el anillo
  // muestra la semana que contiene ese día, igual que la tarjeta.
  const semana = useResumenGestion('semana', periodo === 'dia', referencia)
  const detalle = useDetalleGestion(metrica, periodo, referencia, true)

  const r = resumen.data
  const actual = r ? esPeriodoActual(r.periodo_inicio, r.periodo_fin, hoy) : referencia === null
  const siguiente = r ? referenciaSiguiente(periodo, r.periodo_fin, hoy) : null
  const unidad = periodo === 'dia' ? 'Día' : 'Semana'

  const pendiente = resumen.isPending || detalle.isPending || (periodo === 'dia' && semana.isPending)
  const error = resumen.isError || detalle.isError || (periodo === 'dia' && semana.isError)

  function reintentar() {
    if (resumen.isError) void resumen.refetch()
    if (detalle.isError) void detalle.refetch()
    if (semana.isError) void semana.refetch()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 sm:px-5 sm:pt-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            id={idTitulo}
            className="m-0 text-[0.75rem] font-semibold tracking-[0.06em] text-ink-3 uppercase"
          >
            {METRICAS[metrica].nombre}
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className={`-mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink motion-reduce:transition-none ${FOCO}`}
          >
            <IconoCerrar className="size-5" />
          </button>
        </div>

        <div className="mt-1 flex items-center gap-1">
          <BotonPeriodo
            etiqueta={`${unidad} anterior`}
            deshabilitado={!r}
            onClick={() => r && onCambiarReferencia(sumarDias(r.periodo_inicio, -1))}
          >
            <IconoFlechaAtras className="size-4" />
          </BotonPeriodo>
          {/* aria-live: al mover el período con las flechas, el lector anuncia
              a qué período se llegó. */}
          <p aria-live="polite" className="m-0 min-w-0 flex-1 text-center text-[1rem] font-bold text-ink tabular-nums">
            {r ? (
              etiquetaPeriodo(periodo, r.periodo_inicio, r.periodo_fin, hoy)
            ) : (
              <span aria-hidden className="mx-auto block h-5 w-40 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
            )}
          </p>
          <BotonPeriodo
            etiqueta={`${unidad} siguiente`}
            deshabilitado={!siguiente}
            onClick={() => siguiente && onCambiarReferencia(siguiente.referencia)}
          >
            <IconoFlechaAtras className="size-4 rotate-180" />
          </BotonPeriodo>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {error ? (
          <div className="px-4 py-5 sm:px-5">
            <EstadoError
              titulo="No pudimos cargar el detalle"
              mensaje="Revisá tu conexión y volvé a intentar."
              accion={<BotonError onClick={reintentar}>Reintentar</BotonError>}
            />
          </div>
        ) : pendiente || !r || !detalle.data ? (
          <Esqueleto />
        ) : (
          <>
            <Resumen
              metrica={metrica}
              periodo={periodo}
              resumen={r}
              semana={semana.data}
              filas={detalle.data.filas}
              actual={actual}
            />
            {detalle.data.total > detalle.data.filas.length && (
              <p className="m-0 border-b border-border bg-surface-2 px-4 py-2 text-[0.8rem] text-ink-3 sm:px-5">
                Mostrando {detalle.data.filas.length} de {detalle.data.total}. El desglose cuenta sólo las
                mostradas.
              </p>
            )}
            {detalle.data.filas.length === 0 ? (
              <Vacio metrica={metrica} periodo={periodo} actual={actual} />
            ) : periodo === 'dia' ? (
              <ListaFilas filas={detalle.data.filas} />
            ) : (
              agruparPorDia(detalle.data.filas).map((grupo) => (
                <GrupoDelDia key={grupo.dia} dia={grupo.dia} filas={grupo.filas} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BotonPeriodo({
  etiqueta,
  deshabilitado,
  onClick,
  children,
}: {
  etiqueta: string
  deshabilitado: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className={`grid size-10 shrink-0 place-items-center rounded-lg border border-border text-ink-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none ${FOCO}`}
    >
      {children}
    </button>
  )
}

/**
 * El anillo grande y, al lado, el desglose. El ritmo sólo en el período en
 * curso: en uno pasado ya no hay "cuánto deberías llevar".
 */
function Resumen({
  metrica,
  periodo,
  resumen,
  semana,
  filas,
  actual,
}: {
  metrica: MetricaGestion
  periodo: PeriodoGestion
  resumen: ResumenGestion
  semana: ResumenGestion | undefined
  filas: FilaDetalleGestion[]
  actual: boolean
}) {
  const meta = METRICAS[metrica].metaSemanal
  const delPeriodo = valorDeMetrica(metrica, resumen)
  const delaSemana = semana ? valorDeMetrica(metrica, semana) : null
  const cuando = actual ? 'Hoy' : etiquetaDia(resumen.periodo_inicio)

  // Qué muestra el anillo. En Día, verdes va contra el ritmo diario; los
  // otros dos no tienen meta diaria y el anillo es la semana, como en la
  // tarjeta.
  let anillo: { valor: number; meta: number; etiqueta: string }
  let lineaSemana: ReactNode = null
  if (periodo === 'dia' && metrica === 'verdes') {
    anillo = { valor: delPeriodo, meta: META_DIARIA_VERDES, etiqueta: `${METRICAS.verdes.nombre} del día` }
    if (delaSemana !== null) lineaSemana = <>Semana {delaSemana} de {meta}</>
  } else if (periodo === 'dia') {
    anillo = {
      valor: delaSemana ?? delPeriodo,
      meta,
      etiqueta: `${METRICAS[metrica].nombre} de la semana`,
    }
    lineaSemana = (
      <>
        <span className="font-semibold text-ink-2">
          {cuando} {delPeriodo}
        </span>{' '}
        · semana {delaSemana ?? '—'} de {meta}
      </>
    )
  } else {
    anillo = { valor: delPeriodo, meta, etiqueta: `${METRICAS[metrica].nombre} de la semana` }
  }

  const ritmo: Ritmo | null =
    actual && periodo === 'semana' && metrica !== 'nuevos'
      ? calcularRitmo(delPeriodo, meta, resumen.dia_actual, resumen.dias_totales)
      : null

  // Contactos nuevos no tiene ritmo: es cumplido o no, en la semana.
  const nuevosSemana = periodo === 'semana' ? delPeriodo : delaSemana
  const estadoNuevos =
    metrica !== 'nuevos' || nuevosSemana === null
      ? null
      : nuevosSemana >= meta
        ? { texto: 'Cumplido', clase: 'text-primary' }
        : { texto: actual ? 'Pendiente' : 'No cumplido', clase: 'text-ink-3' }

  const partes = calcularDesglose(metrica, filas)

  return (
    <section
      aria-label="Resumen"
      className="flex items-center gap-4 border-b border-border px-4 py-5 sm:gap-5 sm:px-5"
    >
      <div className="shrink-0">
        <AnilloProgreso
          tamano="grande"
          etiquetaVisible={false}
          etiqueta={anillo.etiqueta}
          valor={anillo.valor}
          meta={anillo.meta}
          marcaEsperado={ritmo?.esperado}
          alerta={ritmo ? !ritmo.alDia : false}
        />
      </div>

      <div className="min-w-0 flex-1 text-[0.85rem]">
        {periodo === 'dia' && metrica !== 'verdes' && (
          <p className="m-0 mb-1 text-[0.75rem] font-semibold text-ink-3">{cuando}</p>
        )}
        <dl className="m-0 grid gap-1">
          {partes.map((parte) => (
            <div key={parte.etiqueta} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
              <dt className="text-ink-3">{parte.etiqueta}</dt>
              <dd className="m-0 font-semibold text-ink tabular-nums">{parte.valor}</dd>
              {parte.subpartes && parte.subpartes.length > 0 && (
                <dd className="col-span-2 m-0 mt-0.5 text-[0.75rem] leading-snug text-ink-3">
                  {parte.subpartes.map((s) => `${s.etiqueta} ${s.valor}`).join(' · ')}
                </dd>
              )}
            </div>
          ))}
        </dl>

        {(lineaSemana || ritmo || estadoNuevos) && (
          <div className="mt-2.5 space-y-0.5 border-t border-border pt-2 text-[0.78rem] text-ink-3 tabular-nums">
            {lineaSemana && <p className="m-0">{lineaSemana}</p>}
            {ritmo && <TextoRitmo ritmo={ritmo} />}
            {estadoNuevos && <p className={`m-0 font-semibold ${estadoNuevos.clase}`}>{estadoNuevos.texto}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

function valorDeMetrica(metrica: MetricaGestion, r: ResumenGestion): number {
  if (metrica === 'verdes') return r.verdes
  if (metrica === 'pre') return r.prelistings + r.prebuyings
  return r.nuevos_contactos
}

/** "Vas al día" o cuánto debería llevar y cuánto falta, en el color del arco. */
export function TextoRitmo({ ritmo }: { ritmo: Ritmo }) {
  if (ritmo.alDia) {
    return <span className="block font-semibold text-primary">Vas al día</span>
  }
  return (
    <span className="block font-semibold text-badge-tibio-ink">
      Deberías llevar {ritmo.esperado} · te faltan {ritmo.faltan}
    </span>
  )
}

/** Los encabezados quedan pegados arriba mientras se scrollea su día. */
function GrupoDelDia({ dia, filas }: { dia: string; filas: FilaDetalleGestion[] }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className="sticky top-0 z-[1] m-0 border-b border-border bg-surface-2 px-4 py-1.5 text-[0.78rem] font-semibold text-ink-2 sm:px-5"
      >
        {etiquetaDiaLarga(dia)} · {filas.length}
      </h3>
      <ListaFilas filas={filas} />
    </section>
  )
}

function ListaFilas({ filas }: { filas: FilaDetalleGestion[] }) {
  return (
    <ul className="m-0 list-none divide-y divide-border p-0">
      {filas.map((fila) => (
        <Fila key={`${fila.fuente}-${fila.id}`} fila={fila} />
      ))}
    </ul>
  )
}

/**
 * Una fila, entera clickeable cuando hay a dónde ir. Si la RLS no deja leer el
 * lead o la propiedad, sale igual —cuenta en el anillo— con un aviso y sin
 * link.
 */
function Fila({ fila }: { fila: FilaDetalleGestion }) {
  const p = presentarFila(fila)
  const IconoTipo =
    fila.fuente === 'interaccion' && fila.tipo
      ? ICONOS[fila.tipo as TipoInteraccion]
      : fila.fuente === 'lead'
        ? IconoPersonaMas
        : null

  const contenido = (
    <>
      {fila.fuente === 'visita' ? (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-softer text-primary"
        >
          <IconoCasa className="size-4" />
        </span>
      ) : (
        <AvatarLead
          nombre={fila.lead_nombre ?? ''}
          apellido={fila.lead_apellido}
          estado={fila.lead_estado as EstadoLead | null}
          className="!size-8 !text-[0.8rem]"
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[0.9rem] font-semibold ${p.disponible ? 'text-ink' : 'text-ink-3'}`}
        >
          {p.titulo}
        </span>
        {p.partes.length > 0 && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[0.78rem] text-ink-3">
            {IconoTipo && <IconoTipo className="size-3.5 shrink-0" />}
            <span className="truncate">{p.partes.join(' · ')}</span>
          </span>
        )}
      </span>
    </>
  )

  const clases = 'flex min-h-14 items-center gap-3 px-4 py-2 sm:px-5'

  return (
    <li>
      {p.ruta ? (
        <Link
          to={p.ruta}
          className={`${clases} text-inherit no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none`}
        >
          {contenido}
        </Link>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </li>
  )
}

const BOTON_PRIMARIO =
  `inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-primary-contrast no-underline transition-colors hover:bg-primary-dark motion-reduce:transition-none ${FOCO}`
const BOTON_SECUNDARIO =
  `inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink-2 no-underline transition-colors hover:border-primary hover:text-primary motion-reduce:transition-none ${FOCO}`

/**
 * Sin filas. En el período en curso invita a actuar; en uno pasado sólo
 * informa, porque ahí ya no hay nada que hacer.
 */
function Vacio({
  metrica,
  periodo,
  actual,
}: {
  metrica: MetricaGestion
  periodo: PeriodoGestion
  actual: boolean
}) {
  const cuando = periodo === 'dia' ? (actual ? 'Hoy' : 'Ese día') : actual ? 'Esta semana' : 'Esa semana'
  const que = {
    verdes: 'reuniones ni visitas',
    pre: 'prelistings ni prebuyings',
    nuevos: 'contactos nuevos',
  }[metrica]
  const titulo = actual ? `${cuando} todavía no registraste ${que}.` : `${cuando} no hubo ${que}.`
  const pista = {
    verdes: null,
    pre: 'Al cargar una reunión en un lead, elegí Prelisting o Prebuying para que cuente acá.',
    nuevos: 'Cuentan los leads con origen Referido o Manual.',
  }[metrica]

  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-5 py-8 text-center">
        <p className="m-0 font-semibold text-ink-2">{titulo}</p>
        {pista && <p className="mx-auto mt-1.5 mb-0 max-w-[40ch] text-[0.85rem] text-ink-3">{pista}</p>}
        {actual && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {metrica === 'verdes' && (
              <>
                <Link to="/tareas" className={BOTON_PRIMARIO}>
                  Agendar visita
                </Link>
                <Link to="/leads" className={BOTON_SECUNDARIO}>
                  Ir a leads
                </Link>
              </>
            )}
            {metrica === 'pre' && (
              <Link to="/leads" className={BOTON_PRIMARIO}>
                Ir a leads
              </Link>
            )}
            {metrica === 'nuevos' && (
              <Link to="/leads/nuevo" className={BOTON_PRIMARIO}>
                Cargar lead
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** El resumen y cuatro filas, con la forma de lo que viene. */
function Esqueleto() {
  const pulso = 'animate-pulse rounded bg-surface-2 motion-reduce:animate-none'
  return (
    <div aria-busy="true" aria-label="Cargando detalle">
      <div className="flex items-center gap-4 border-b border-border px-4 py-5 sm:gap-5 sm:px-5">
        <span aria-hidden className={`size-[112px] shrink-0 !rounded-full sm:size-[150px] ${pulso}`} />
        <span aria-hidden className="flex-1 space-y-2.5">
          <span className={`block h-3.5 w-3/4 ${pulso}`} />
          <span className={`block h-3.5 w-2/3 ${pulso}`} />
          <span className={`block h-3 w-1/2 ${pulso}`} />
        </span>
      </div>
      <ul aria-hidden className="m-0 list-none divide-y divide-border p-0">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex min-h-14 items-center gap-3 px-4 py-2 sm:px-5">
            <span className={`size-8 shrink-0 !rounded-full ${pulso}`} />
            <span className="flex-1 space-y-1.5">
              <span className={`block h-3.5 w-2/3 ${pulso}`} />
              <span className={`block h-3 w-1/3 ${pulso}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
