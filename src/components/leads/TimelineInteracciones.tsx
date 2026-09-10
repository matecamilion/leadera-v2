import type { Interaccion } from '../../lib/api/interacciones'
// `HORAS_DE_EDICION` ya no se importa: era sólo para el cartel de "no editable"
// que este timeline dejó de mostrar. La constante sigue viviendo —y usándose—
// en `lib/api/interacciones.ts`, que es quien define la ventana.
import { dentroDeVentanaDeEdicion, etiquetaTipoInteraccion } from '../../lib/api/interacciones'
import { IconoConversacion, IconoLapiz, IconoReloj, IconoTacho } from './Iconos'
import { ICONOS } from './iconosInteraccion'

const DIA_MES = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })
const DIA_MES_ANIO = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * "24 de agosto, 14:30". El año sólo aparece si no es el actual: en un
 * historial que casi siempre es reciente, repetirlo es ruido.
 */
function formatearMomento(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const esteAnio = fecha.getFullYear() === new Date().getFullYear()
  const dia = (esteAnio ? DIA_MES : DIA_MES_ANIO).format(fecha)
  return `${dia}, ${HORA.format(fecha)}`
}

interface TimelineInteraccionesProps {
  interacciones: Interaccion[]
  cargando: boolean
  error?: string | null
  /**
   * Acciones por fila. Si no vienen, el timeline queda de sólo lectura: así lo
   * usa cualquier pantalla que muestre el historial sin poder tocarlo.
   */
  onEditar?: (interaccion: Interaccion) => void
  onEliminar?: (interaccion: Interaccion) => void
}

export function TimelineInteracciones({
  interacciones,
  cargando,
  error,
  onEditar,
  onEliminar,
}: TimelineInteraccionesProps) {
  if (cargando) return <Skeleton />

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (interacciones.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
        <div className="mb-2 flex justify-center text-ink-4">
          <IconoConversacion className="size-10" />
        </div>
        <h3 className="mb-1.5 font-semibold text-ink-2">Sin interacciones</h3>
        <p className="text-[0.9rem]">
          Todavía no registraste ninguna conversación con este lead.
        </p>
      </div>
    )
  }

  return (
    /*
     * Una sola superficie para todo el historial, en vez de una card por
     * interacción: el borde y el fondo los pone este contenedor y los ítems se
     * separan con una línea. Con cards sueltas, cada entrada traía su propio
     * marco y su sombra, y una conversación de diez interacciones se leía como
     * diez objetos distintos en vez de como un historial.
     */
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
      {/*
       * El canal del timeline mide 44px (`pl-11`) y adentro van la línea y los
       * puntos, los dos centrados en x=22. Antes el canal eran 32px y el punto
       * arrancaba en x=0: mientras el `<ol>` flotaba suelto en la pestaña eso
       * no se notaba, pero con el contenedor y su borde el punto quedaba
       * montado encima del borde, sin un pixel de aire.
       *
       * La línea arranca en el centro del primer punto (`top-[32px]`, ver el
       * cálculo en el `<li>`) en vez de unos pixeles más arriba: así nace desde
       * abajo del punto y no le asoma un cabito por encima. Por abajo llega
       * hasta el final, y el último ítem la tapa —ver su `after`—, de modo que
       * lo que se ve va de centro de punto a centro de punto.
       *
       * Los divisores arrancan a los 44px, después del canal, así que la línea
       * los cruza sin cortarse.
       */}
      <ol className="relative divide-y divide-border pl-11 before:absolute before:top-[32px] before:bottom-0 before:left-[21px] before:w-0.5 before:bg-border">
        {interacciones.map((interaccion) => {
          const Icono = ICONOS[interaccion.tipo] ?? IconoReloj
          // La policy de la base es la que decide; esto sólo evita ofrecer un
          // botón que iba a rebotar. Se calcula en el render: la ventana casi
          // nunca vence con la pantalla abierta, y si pasa, el error de la base
          // lo explica.
          const editable = dentroDeVentanaDeEdicion(interaccion.created_at)
          const hayAcciones = Boolean(onEditar || onEliminar)
          // `pr-5 py-4` y no `px-5`: la sangría izquierda del texto ya la da el
          // `pl-11` del `<ol>`, y sumarle otro padding acá lo empujaba dos veces.
          //
          // El `after` sólo aparece en el último ítem y pinta del color del fondo
          // por encima de la línea, desde el centro de su punto hacia abajo: es
          // lo que hace que la línea termine en el último punto en vez de seguir
          // hasta el piso del contenedor. Con una sola interacción tapa el largo
          // entero y no queda línea, que es lo correcto —un punto solo no
          // conecta con nada—.
          return (
            <li
              key={interaccion.id}
              className="relative py-4 pr-5 last:after:absolute last:after:top-[32px] last:after:bottom-0 last:after:-left-[23px] last:after:w-0.5 last:after:bg-surface"
            >
              {/* `top-[26px]` centra el punto con la primera línea del
                  contenido: `py-4` baja 16px hasta el badge del ícono, que mide
                  32px, así que su centro cae a 32px del borde del `<li>` y el
                  punto —de 12px— arranca 6px antes. Antes decía `top-3` y
                  quedaba pegado al techo del badge, no a su centro.
                  `-left-7` lo deja centrado en x=22, igual que la línea. */}
              <span
                aria-hidden
                className="absolute top-[26px] -left-7 z-[2] size-3 rounded-full border-[3px] border-surface bg-primary"
              />

              {/* `group` para que el footer de acciones aparezca al pasar por la
                  fila entera, y no sólo al pasar por los botones. */}
              <article className="group">
                <header className="mb-2 flex flex-col gap-1 min-[600px]:flex-row min-[600px]:flex-wrap min-[600px]:items-center min-[600px]:justify-between min-[600px]:gap-3">
                  <span className="flex items-center gap-2 font-semibold text-ink-2">
                    {/* Mismo badge que `PropiedadesSinMovimiento` y las cards de
                        coincidencias: `size-8` con `bg-brand-softer` y el ícono a
                        `size-4` adentro. El color va en el contenedor porque los
                        SVG de `Iconos.tsx` pintan con `currentColor`. */}
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-softer text-primary"
                    >
                      <Icono className="size-4" />
                    </span>
                    {etiquetaTipoInteraccion(interaccion.tipo)}
                  </span>
                  <span className="text-[0.85rem] text-ink-4">
                    {formatearMomento(interaccion.fecha)}
                  </span>
                </header>

                <p className="m-0 text-[0.95rem] leading-relaxed break-words text-ink-2">
                  {interaccion.detalle || 'Sin detalle'}
                </p>

                {/* Vencida la ventana no se renderiza nada: el aviso de "no
                    editable" ocupaba una fila entera en cada card vieja para
                    contar algo que ya no se puede hacer, y el historial se lee
                    de arriba abajo. Que los botones no estén es la única señal
                    que hace falta. */}
                {hayAcciones && editable && (
                  <footer className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
                    {onEditar && (
                      <button
                        type="button"
                        onClick={() => onEditar(interaccion)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-[6px] text-[0.8rem] font-medium text-ink-3 transition hover:border-primary hover:text-primary motion-reduce:transition-none"
                      >
                        <IconoLapiz className="size-4" />
                        Editar
                      </button>
                    )}
                    {onEliminar && (
                      <button
                        type="button"
                        onClick={() => onEliminar(interaccion)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-peligro-borde bg-transparent px-3 py-[6px] text-[0.8rem] font-medium text-peligro-ink opacity-65 transition hover:bg-peligro-soft hover:opacity-100 motion-reduce:transition-none"
                      >
                        <IconoTacho className="size-4" />
                        Eliminar
                      </button>
                    )}
                  </footer>
                )}
              </article>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando interacciones" className="space-y-5 pl-8">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
