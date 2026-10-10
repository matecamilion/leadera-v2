import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Fila de lista densa, sin cards: separadores finos, la jerarquía sale del
 * peso y del tono del texto, no de cajas ni fondos.
 *
 * Slots, de izquierda a derecha:
 *   titulo     lo principal. Con `to` es el enlace de toda la fila.
 *   subtitulo  contexto en gris, una línea.
 *   datos      columnas de dato (monto, fecha...), alineadas a la derecha.
 *   indicador  estado que pide atención (temperatura, "sin mover").
 *   accion     acción principal de la fila (botón o menú); queda clicable
 *              aunque la fila entera sea un enlace.
 *
 * Se usa adentro de <ListaFilas>.
 */
interface FilaListaProps {
  titulo: ReactNode
  /** Si se pasa, el título es un enlace que cubre toda la fila. */
  to?: string
  subtitulo?: ReactNode
  datos?: ReactNode[]
  indicador?: ReactNode
  accion?: ReactNode
}

export function ListaFilas({
  children,
  etiqueta,
}: {
  children: ReactNode
  etiqueta?: string
}) {
  return (
    <ul aria-label={etiqueta} className="divide-y divide-border border-y border-border">
      {children}
    </ul>
  )
}

export function FilaLista({ titulo, to, subtitulo, datos, indicador, accion }: FilaListaProps) {
  return (
    <li
      className={`relative flex flex-wrap items-center gap-x-6 gap-y-1 py-3 ${
        to ? 'transition-colors hover:bg-surface-2/60 motion-reduce:transition-none' : ''
      }`}
    >
      <div className="min-w-[12rem] flex-1">
        <p className="truncate text-cuerpo font-semibold text-ink">
          {to ? (
            // Enlace estirado: el ::after cubre la fila entera, y lo que
            // necesita clic propio (`accion`) se eleva con z-10.
            <Link to={to} className="after:absolute after:inset-0 focus-visible:outline-offset-0">
              {titulo}
            </Link>
          ) : (
            titulo
          )}
        </p>
        {subtitulo && <p className="truncate text-meta text-ink-3">{subtitulo}</p>}
      </div>

      {datos && datos.length > 0 && (
        <div className="num flex items-baseline gap-6 text-cuerpo">
          {datos.map((dato, i) => (
            <div key={i} className="min-w-20 text-right">
              {dato}
            </div>
          ))}
        </div>
      )}

      {indicador && <div className="text-meta font-semibold">{indicador}</div>}

      {accion && <div className="relative z-10">{accion}</div>}
    </li>
  )
}
