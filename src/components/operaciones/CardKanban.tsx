import { useSortable } from '@dnd-kit/sortable'
import { Link } from 'react-router-dom'
import { formatearMonto, type OperacionKanban, type TipoOperacion } from '../../lib/api/operaciones'
import { diasSinMovimiento, esOperacionTrabada } from '../../lib/kanbanUtils'
import { linkTelefono, linkWhatsApp } from '../../lib/telefono'
import { IconoChat, IconoReloj, IconoTelefono } from '../leads/Iconos'

/** Barra lateral por tipo. Mismos colores que BadgeTipoOperacion. */
const BARRA: Record<TipoOperacion, string> = {
  VENTA: 'bg-primary',
  COMPRA: 'bg-frio',
  ALQUILER: 'bg-tibio',
}

export function CardKanban({ operacion }: { operacion: OperacionKanban }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: operacion.id })

  const trabada = esOperacionTrabada(operacion.updated_at)
  const telefono = operacion.lead?.telefono

  return (
    <article
      ref={setNodeRef}
      // Escrito a mano en vez de usar `CSS.Translate` de @dnd-kit/utilities:
      // ese paquete sólo está como dependencia transitiva y no quiero
      // depender del hoisting de npm para algo de una línea.
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={[
        'relative overflow-hidden rounded-xl border bg-surface pl-3 shadow-sm',
        'transition-shadow motion-reduce:transition-none',
        isDragging ? 'z-10 opacity-50 shadow-md' : '',
        trabada ? 'border-tibio' : 'border-border',
      ].join(' ')}
    >
      {/* La barra de color no participa del drag: es decorativa. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1.5 ${BARRA[operacion.tipo]}`}
      />

      {/* El área arrastrable es sólo el cuerpo: así los links y botones de
          abajo quedan libres para recibir clicks sin pelear con el sensor. */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-3 active:cursor-grabbing"
      >
        <p className="text-[1.15rem] leading-tight font-bold text-ink tabular-nums">
          {formatearMonto(operacion.monto, operacion.moneda)}
        </p>

        <p className="mt-1 truncate text-[0.85rem] font-semibold text-ink-2">
          {operacion.lead
            ? `${operacion.lead.nombre} ${operacion.lead.apellido ?? ''}`.trim()
            : 'Sin vincular'}
        </p>

        <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-ink-3">
          {operacion.titulo || 'Sin título'}
        </p>

        {trabada && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-warm-soft px-2 py-0.5 text-[0.68rem] font-bold text-badge-tibio-ink uppercase">
            <IconoReloj className="size-3" />
            {diasSinMovimiento(operacion.updated_at)} días sin mover
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <div className="flex items-center gap-1">
          {telefono && (
            <>
              {/* stopPropagation + onPointerDown: sin esto el sensor del drag
                  se queda con el gesto y el link nunca llega a abrirse. */}
              <a
                href={linkTelefono(telefono)}
                aria-label={`Llamar a ${operacion.lead?.nombre ?? 'el lead'}`}
                title="Llamar"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-brand-softer hover:text-primary motion-reduce:transition-none"
              >
                <IconoTelefono className="size-4" />
              </a>
              <a
                href={linkWhatsApp(telefono)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp a ${operacion.lead?.nombre ?? 'el lead'}`}
                title="WhatsApp"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-brand-softer hover:text-primary motion-reduce:transition-none"
              >
                <IconoChat className="size-4" />
              </a>
            </>
          )}
        </div>

        <Link
          to={`/operaciones/${operacion.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="text-[0.78rem] font-semibold whitespace-nowrap text-primary hover:underline"
        >
          Ver detalle →
        </Link>
      </div>
    </article>
  )
}
