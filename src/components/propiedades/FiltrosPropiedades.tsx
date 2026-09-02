import { useEffect, useState } from 'react'
import {
  ESTADOS_PROPIEDAD,
  TIPOS_PROPIEDAD,
  type EstadoPropiedad,
  type TipoPropiedad,
} from '../../lib/api/propiedades'

/** Los rangos numéricos, ya confirmados. `undefined` = sin filtrar. */
export interface RangosPropiedad {
  precioMin: number | undefined
  precioMax: number | undefined
  ambientesMin: number | undefined
}

interface FiltrosPropiedadesProps {
  busqueda: string
  onBusqueda: (v: string) => void
  estado: EstadoPropiedad | undefined
  onEstado: (v: EstadoPropiedad | undefined) => void
  tipo: TipoPropiedad | undefined
  onTipo: (v: TipoPropiedad | undefined) => void
  rangos: RangosPropiedad
  onRangos: (r: RangosPropiedad) => void
  /**
   * Borra tipo y rangos de una sola vez.
   *
   * Va aparte de `onTipo` + `onRangos` y no es un capricho: encadenar esas dos
   * en el mismo tick hace que la segunda escriba la URL con el `tipo` del
   * render anterior y lo reponga. Una sola escritura no tiene esa carrera.
   */
  onLimpiarAvanzados: () => void
  debounceMs?: number
}

const CONTROL =
  'rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.92rem] text-ink placeholder:text-ink-3 transition-colors focus:border-primary focus:outline-none motion-reduce:transition-none'

/** `undefined` → ''. Lo que se le muestra al input cuando no hay filtro. */
function aTexto(valor: number | undefined): string {
  return valor === undefined ? '' : String(valor)
}

/**
 * Texto del input → número, o `undefined` si no filtra.
 *
 * Mismo criterio que el saneo de la URL: lo que no sea un número de 1 para
 * arriba se ignora en vez de rechazarse. Un 0 o un negativo no acotan nada
 * —el precio y los ambientes arrancan en 1 por constraint de la base— y
 * tratarlos como "sin filtro" evita listas vacías sin explicación.
 */
function aNumero(texto: string): number | undefined {
  if (!texto.trim()) return undefined
  const n = Number(texto)
  return Number.isFinite(n) && n >= 1 ? n : undefined
}

/**
 * Buscador + estado siempre a la vista; el resto detrás de "Más filtros".
 *
 * Seis controles en una fila se leen como un formulario, no como un filtro. Los
 * dos que el agente usa todo el tiempo quedan afuera y los otros cuatro se
 * despliegan, con el contador al lado para que el panel cerrado no esconda que
 * hay filtros puestos.
 *
 * El panel arranca abierto si ya venía algo aplicado —un link compartido, un
 * F5, el botón atrás—: si no, la lista aparecería recortada sin nada visible
 * que lo explique.
 */
export function FiltrosPropiedades({
  busqueda,
  onBusqueda,
  estado,
  onEstado,
  tipo,
  onTipo,
  rangos,
  onRangos,
  onLimpiarAvanzados,
  debounceMs = 300,
}: FiltrosPropiedadesProps) {
  const [texto, setTexto] = useState(busqueda)
  const [precioMin, setPrecioMin] = useState(() => aTexto(rangos.precioMin))
  const [precioMax, setPrecioMax] = useState(() => aTexto(rangos.precioMax))
  const [ambientesMin, setAmbientesMin] = useState(() => aTexto(rangos.ambientesMin))

  const activos =
    (tipo ? 1 : 0) +
    (rangos.precioMin !== undefined ? 1 : 0) +
    (rangos.precioMax !== undefined ? 1 : 0) +
    (rangos.ambientesMin !== undefined ? 1 : 0)

  const [abierto, setAbierto] = useState(() => activos > 0)

  // El texto vive acá para que el input responda a cada tecla; al padre
  // —y a la query— sólo llega cuando deja de tipear.
  useEffect(() => {
    if (texto === busqueda) return
    const id = setTimeout(() => onBusqueda(texto), debounceMs)
    return () => clearTimeout(id)
  }, [texto, busqueda, onBusqueda, debounceMs])

  // Los tres numéricos comparten un solo debounce: se escriben juntos en la
  // URL, así que separarlos sólo generaría dos navegaciones seguidas.
  useEffect(() => {
    const sinCambios =
      precioMin === aTexto(rangos.precioMin) &&
      precioMax === aTexto(rangos.precioMax) &&
      ambientesMin === aTexto(rangos.ambientesMin)
    if (sinCambios) return

    const id = setTimeout(() => {
      onRangos({
        precioMin: aNumero(precioMin),
        precioMax: aNumero(precioMax),
        ambientesMin: aNumero(ambientesMin),
      })
    }, debounceMs)
    return () => clearTimeout(id)
  }, [precioMin, precioMax, ambientesMin, rangos, onRangos, debounceMs])

  function limpiarAvanzados() {
    setPrecioMin('')
    setPrecioMax('')
    setAmbientesMin('')
    onLimpiarAvanzados()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar propiedades"
          placeholder="Buscar por dirección o zona..."
          className={`min-w-60 flex-1 ${CONTROL}`}
        />

        <select
          value={estado ?? ''}
          onChange={(e) =>
            onEstado((e.target.value || undefined) as EstadoPropiedad | undefined)
          }
          aria-label="Filtrar por estado"
          className={CONTROL}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_PROPIEDAD.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className={`inline-flex items-center gap-2 whitespace-nowrap ${CONTROL} ${
            activos > 0 ? 'border-primary text-primary' : ''
          }`}
        >
          Más filtros
          {activos > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-white">
              {activos}
            </span>
          )}
          <span aria-hidden className="text-ink-3">
            {abierto ? '▲' : '▼'}
          </span>
        </button>
      </div>

      {abierto && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
          <select
            value={tipo ?? ''}
            onChange={(e) =>
              onTipo((e.target.value || undefined) as TipoPropiedad | undefined)
            }
            aria-label="Filtrar por tipo"
            className={CONTROL}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={precioMin}
            onChange={(e) => setPrecioMin(e.target.value)}
            aria-label="Precio mínimo"
            placeholder="Precio mín."
            className={`w-36 ${CONTROL}`}
          />
          <input
            type="number"
            min={1}
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
            aria-label="Precio máximo"
            placeholder="Precio máx."
            className={`w-36 ${CONTROL}`}
          />

          <input
            type="number"
            min={1}
            step={1}
            value={ambientesMin}
            onChange={(e) => setAmbientesMin(e.target.value)}
            aria-label="Ambientes mínimos"
            placeholder="Ambientes mín."
            className={`w-40 ${CONTROL}`}
          />

          {activos > 0 && (
            <button
              type="button"
              onClick={limpiarAvanzados}
              className="rounded-lg px-3 py-2.5 text-[0.88rem] font-semibold text-primary transition-colors hover:bg-brand-softer motion-reduce:transition-none"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
