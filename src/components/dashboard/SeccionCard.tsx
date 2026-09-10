import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TONOS, type TonoKpi } from '../comunes/tonos'

interface SeccionCardProps {
  /** El SVG ya dimensionado; la card sólo pinta el chip que lo rodea. */
  icono: ReactNode
  /** Mismo vocabulario de color que `CardKpi`: la card de arriba y la sección
   *  de abajo que hablan del mismo dato usan el mismo tono. */
  tono: TonoKpi
  titulo: string
  subtitulo: string
  /** Conteo al lado del título. Toma el color del `tono`. */
  badge?: string
  /** El "Ver todas". Se omite cuando no hay más de lo que ya se muestra. */
  verTodos?: { ruta: string; texto: string }
  /** Utilidades del contenedor, para el `lg:col-span-2` de la grilla. */
  className?: string
  children: ReactNode
}

/**
 * La card que envuelve una sección del dashboard.
 *
 * Es el mismo contenedor que ya usan `SeccionProgreso`, `SeccionCoincidencias`
 * y las cards de Estadísticas, extraído acá porque las cuatro listas de Mi día
 * repetían el header entero.
 *
 * El padding es `p-4` y no el `p-5` que usan esas otras cards: Mi día apila
 * ocho secciones y es la pantalla que se recorre entera varias veces por día,
 * así que un escalón menos de aire adentro de cada card se traduce en una
 * sección más arriba del pliegue. Las pantallas que muestran una card sola
 * —los gráficos de Perfil, el panel de Tareas— se quedan en `p-5`: ahí el aire
 * no cuesta nada.
 *
 * `SeccionProgreso` y `SeccionCoincidencias` no lo usan a propósito: su header
 * tiene un chip circular que cambia de color, un subtítulo con markup y un badge
 * invertido. Meterlas obligaría a cinco props de escape para dos casos.
 *
 * Las listas de adentro pierden su borde y su radio propios —dentro de una card
 * blanca, un marco a 20px de otro marco se lee como card dentro de card— y las
 * filas pierden su `px-4`: el aire lateral ya lo pone el `p-4`. Eso se apaga
 * desde acá y no tocando `FilaLead` y compañía, que se comparten con otras
 * pantallas: el selector de hijo directo tiene más especificidad que el `px-4`
 * de la fila, así que gana sin depender del orden del CSS.
 */
export function SeccionCard({
  icono,
  tono,
  titulo,
  subtitulo,
  badge,
  verTodos,
  className = '',
  children,
}: SeccionCardProps) {
  return (
    <section
      className={`mb-5 rounded-2xl border border-border bg-surface p-4 shadow-sm [&>ul>li]:px-0 [&>ul>li>a]:px-0 ${className}`.trim()}
    >
      <header className="mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${TONOS[tono]}`}
          >
            {icono}
          </span>

          <h2 className="m-0 text-[1.05rem] font-bold text-ink">{titulo}</h2>

          {badge && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold ${TONOS[tono]}`}
            >
              {badge}
            </span>
          )}

          {verTodos && (
            <Link
              to={verTodos.ruta}
              className="ml-auto text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
            >
              {verTodos.texto}
            </Link>
          )}
        </div>

        <p className="mt-1 text-[0.85rem] text-ink-3">{subtitulo}</p>
      </header>

      {children}
    </section>
  )
}
