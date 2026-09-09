import { Link } from 'react-router-dom'
import { BadgeEstadoPropiedad } from '../propiedades/BadgeEstadoPropiedad'
import { IconoCasa } from '../leads/Iconos'
import { usePropiedadesRecientes } from '../../hooks/usePropiedades'
import {
  etiquetaTipo,
  formatearPrecio,
  type PropiedadConPropietario,
} from '../../lib/api/propiedades'

/** Cuántas filas entran en el resumen. El "Ver todas" aparece si hay más. */
const MOSTRADAS = 3

/**
 * Lo último que entró a la cartera.
 *
 * Misma anatomía que `ListaLeads` —chip de ícono, título, badge de conteo, "Ver
 * todas" y una sola superficie con las filas separadas por línea—, pero se trae
 * sus propios datos en vez de recibirlos: es una sección secundaria de Mi día y
 * no tiene por qué hacer esperar a los leads del día.
 *
 * Si la query falla la sección desaparece, igual que `SeccionProgreso`: que no
 * se pueda leer la cartera no es motivo para romper la jornada entera.
 */
export function ListaPropiedadesRecientes() {
  const { data, isPending, isError } = usePropiedadesRecientes(MOSTRADAS)

  if (isError) return null
  if (isPending || !data) return <SkeletonSeccion />

  const propiedades = data.data
  const hayMas = data.count > propiedades.length

  return (
    <section className="mb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-primary"
          >
            <IconoCasa className="size-[18px]" />
          </span>

          <h2 className="m-0 text-[1.05rem] font-bold text-ink">
            Propiedades recientes
          </h2>

          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[0.72rem] font-bold text-primary">
            {propiedades.length} {propiedades.length === 1 ? 'nueva' : 'nuevas'}
          </span>

          {hayMas && (
            <Link
              to="/propiedades"
              className="ml-auto text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Ver todas ({data.count}) →
            </Link>
          )}
        </div>

        <p className="mt-1 text-[0.85rem] text-ink-3">
          Lo último que sumaste a la cartera
        </p>
      </header>

      {propiedades.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          Todavía no cargaste propiedades.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {propiedades.map((propiedad) => (
            <FilaPropiedad key={propiedad.id} propiedad={propiedad} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Una propiedad: qué es a la izquierda, cuánto vale y cómo está a la derecha. */
function FilaPropiedad({ propiedad }: { propiedad: PropiedadConPropietario }) {
  // La columna es `string[]` con default `{}`, pero una fila vieja puede venir
  // sin nada: `?.[0]` cubre el array vacío y el null de la base por igual.
  const foto = propiedad.fotos_urls?.[0]

  return (
    <li>
      <Link
        to={`/propiedades/${propiedad.id}`}
        // El outline va hacia adentro: la `ul` recorta con `overflow-hidden` y
        // un offset positivo dejaría el foco de la primera fila invisible.
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {foto ? (
          <img
            src={foto}
            alt=""
            loading="lazy"
            className="size-11 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-4"
          >
            <IconoCasa className="size-5" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">
            {propiedad.direccion}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {etiquetaTipo(propiedad.tipo)}
            {propiedad.zona ? ` · ${propiedad.zona}` : ''}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[0.85rem] font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatearPrecio(propiedad.precio, propiedad.moneda)}
          </span>
          <span className="mt-1 block">
            <BadgeEstadoPropiedad estado={propiedad.estado} />
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Mismo idioma visual que el skeleton de Mi día: barra de título y un bloque
 * del alto que va a ocupar la lista, para que no salte al llegar los datos.
 */
function SkeletonSeccion() {
  return (
    <div aria-hidden className="mb-8">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[203px] animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
