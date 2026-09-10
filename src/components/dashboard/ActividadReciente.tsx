import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
import {
  IconoCajas,
  IconoCasa,
  IconoChat,
  IconoCheck,
  IconoConversacion,
  IconoLapiz,
  IconoMail,
  IconoReloj,
  IconoTelefono,
  IconoUsuarios,
} from '../leads/Iconos'
import { useActividadReciente } from '../../hooks/useActividadReciente'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import {
  rutaDeActividad,
  tituloDeActividad,
  type ActividadReciente as Actividad,
} from '../../lib/api/actividad'
import type { TipoInteraccion } from '../../lib/api/interacciones'

type Icono = (p: { className?: string }) => ReactNode

/**
 * Ícono por clase de evento. Mismo criterio que el timeline del lead: la
 * imagen dice de qué se trata antes que el texto.
 */
const ICONO: Record<Actividad['tipo'], Icono> = {
  INTERACCION: IconoConversacion,
  TAREA_COMPLETADA: IconoCheck,
  VISITA_REALIZADA: IconoCasa,
  PROPIEDAD_CREADA: IconoCasa,
  OPERACION_CREADA: IconoCajas,
}

/**
 * Cuando la interacción trae su enum, el ícono baja a ese detalle: un WhatsApp
 * y una llamada se distinguen de un vistazo. Es la misma tabla que usa
 * `TimelineInteracciones`, con los mismos íconos.
 */
const ICONO_INTERACCION: Record<TipoInteraccion, Icono> = {
  LLAMADA: IconoTelefono,
  WHATSAPP: IconoChat,
  EMAIL: IconoMail,
  VISITA: IconoCasa,
  REUNION: IconoUsuarios,
  NOTA_INTERNA: IconoLapiz,
  SEGUIMIENTO: IconoReloj,
  CONSULTA: IconoConversacion,
}

/**
 * Devuelve el ícono ya renderizado y no el componente: asignar el componente a
 * una variable dentro de la fila lo hace ver como uno creado en cada render.
 */
function iconoDe(item: Actividad): ReactNode {
  const Componente: Icono =
    item.tipo === 'INTERACCION' && item.subtipo
      ? (ICONO_INTERACCION[item.subtipo as TipoInteraccion] ?? ICONO.INTERACCION)
      : (ICONO[item.tipo] ?? IconoReloj)

  return <Componente className="size-[16px]" />
}

/**
 * Lo último que el agente dejó hecho, en un solo feed.
 *
 * Como `ListaPropiedadesRecientes` y `ListaOperacionesEnCurso` se trae sus
 * propios datos y se esconde si la query falla: es el registro de la jornada,
 * no la jornada, y una sección rota no debería tapar el resto de la pantalla.
 */
export function ActividadReciente() {
  const { data, isPending, isError } = useActividadReciente()

  if (isError) return null
  if (isPending || !data) return <SkeletonSeccion />

  return (
    <SeccionCard
      icono={<IconoReloj className="size-[18px]" />}
      tono="neutro"
      titulo="Actividad reciente"
      subtitulo="Lo último que registraste"
      badge={data.length > 0 ? `${data.length}` : undefined}
    >
      {data.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          Todavía no registraste actividad.
        </p>
      ) : (
        // Sin borde ni radio propios: los pone la card que la envuelve.
        <ul className="divide-y divide-border">
          {data.map((item) => (
            <FilaActividad key={`${item.tipo}-${item.origen_id}`} item={item} />
          ))}
        </ul>
      )}
    </SeccionCard>
  )
}

/** Un evento: qué pasó a la izquierda, hace cuánto a la derecha. */
function FilaActividad({ item }: { item: Actividad }) {
  const ruta = rutaDeActividad(item)

  const contenido = (
    <>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink-3"
      >
        {iconoDe(item)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">
          {tituloDeActividad(item)}
        </span>
        {item.descripcion && (
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {item.descripcion}
          </span>
        )}
      </span>

      <span className="shrink-0 text-[0.78rem] whitespace-nowrap text-ink-3 tabular-nums">
        {tiempoTranscurrido(item.fecha)}
      </span>
    </>
  )

  // Una tarea suelta no cuelga de ninguna ficha: se muestra igual, pero como
  // texto. Un <Link> que no lleva a ningún lado es peor que no tenerlo.
  return (
    <li>
      {ruta ? (
        <Link
          to={ruta}
          // El outline va hacia adentro, igual que en las otras listas: la
          // card recorta y un offset positivo dejaría el foco fuera de vista.
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {contenido}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{contenido}</div>
      )}
    </li>
  )
}

/**
 * Mismo idioma visual que el skeleton de Mi día: barra de título y un bloque
 * del alto que va a ocupar la lista, para que no salte al llegar los datos.
 */
function SkeletonSeccion() {
  return (
    <div aria-hidden className="mb-5">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[193px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
