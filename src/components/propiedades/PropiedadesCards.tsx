import { Link } from 'react-router-dom'
import {
  etiquetaTipo,
  formatearPrecio,
  type PropiedadConPropietario,
} from '../../lib/api/propiedades'
import { IconoCasa } from '../leads/Iconos'
import { BadgeEstadoPropiedad } from './BadgeEstadoPropiedad'

interface PropiedadesCardsProps {
  propiedades: PropiedadConPropietario[]
  /**
   * Saca la columna "Propietario".
   *
   * En la tab de la ficha del lead todas las filas dirían el mismo nombre —el
   * del lead que estás mirando—, así que ahí es ruido. Mismo criterio con el
   * que `ListaOperacionesCompacta` recorta columnas conocidas por contexto.
   */
  ocultarPropietario?: boolean
}

/**
 * La cartera apilada en cards. Se usa por debajo de `md` y en la tab del lead.
 *
 * Mismo esqueleto que las coincidencias de una búsqueda: la card entera es el
 * link a la ficha, con la miniatura a la izquierda y una columna a la derecha
 * que reparte el contenido con `justify-between` —arriba qué es, abajo cuánto
 * vale y cómo está—. Antes el precio vivía en un `<dl>` de dos columnas y
 * abajo iba un "Ver detalle" a todo el ancho: ese botón repetía lo que la card
 * ya hacía al tocarla, y la segunda columna del `<dl>` quedaba vacía cuando el
 * propietario no se mostraba.
 */
export function PropiedadesCards({
  propiedades,
  ocultarPropietario = false,
}: PropiedadesCardsProps) {
  return (
    <ul className="space-y-3">
      {propiedades.map((p) => (
        <li key={p.id}>
          <Link
            to={`/propiedades/${p.id}`}
            className="flex items-stretch gap-4 rounded-[16px] border border-border bg-surface p-4 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            {/* Caja de tamaño fijo: la miniatura entra recortada y, sin foto,
                el hueco lo llena el placeholder. La card mide lo mismo en los
                dos casos. */}
            {p.fotos_urls?.[0] ? (
              <img
                src={p.fotos_urls[0]}
                alt=""
                loading="lazy"
                className="size-20 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-4"
              >
                <IconoCasa className="size-7" />
              </span>
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{p.direccion}</p>
                {/* Ambientes y metros sólo si están cargados: la línea es un
                    resumen, no una planilla con guiones. */}
                <p className="mt-0.5 truncate text-[0.82rem] text-ink-3">
                  {etiquetaTipo(p.tipo)}
                  {p.zona ? ` · ${p.zona}` : ''}
                  {p.ambientes != null ? ` · ${p.ambientes} amb.` : ''}
                  {p.metros_cuadrados != null ? ` · ${p.metros_cuadrados} m²` : ''}
                </p>

                {/* Texto y no link, aunque antes lo fuera: con la card entera
                    envuelta en un `<a>`, un `<a>` adentro no es HTML válido.
                    Acá el propietario es contexto —de quién es esto—, no un
                    destino; para ir a su ficha está la propia ficha de la
                    propiedad. Misma trampa que documenta `ListaLeads`. */}
                {!ocultarPropietario && p.lead_propietario && (
                  <p className="mt-0.5 truncate text-[0.78rem] text-ink-4">
                    {p.lead_propietario.nombre} {p.lead_propietario.apellido ?? ''}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink tabular-nums">
                  {formatearPrecio(p.precio, p.moneda)}
                </span>
                <BadgeEstadoPropiedad estado={p.estado} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
