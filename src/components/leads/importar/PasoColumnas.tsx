import { useId, useMemo } from 'react'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import {
  asignarColumna,
  mapeoTieneNombre,
  type CampoDestino,
  type MapeoColumnas,
} from '../../../lib/importarLeads/mapeoColumnas'
import { normalizarFilas } from '../../../lib/importarLeads/normalizarFilas'
import { etiquetaEstado } from '../../../lib/etiquetasLead'
import { CLASES_CONTROL } from '../../comunes/estilosFormulario'

/** Cuántas filas se muestran para comprobar el mapeo. */
export const FILAS_DE_VISTA_PREVIA = 5

interface CampoUi {
  campo: CampoDestino
  label: string
  ayuda?: string
}

/** Los campos a mapear, en el orden en que se muestran. `origen` no: es fijo. */
const CAMPOS: CampoUi[] = [
  { campo: 'nombre', label: 'Nombre' },
  { campo: 'apellido', label: 'Apellido' },
  {
    campo: 'nombreCompleto',
    label: 'Nombre completo',
    ayuda: 'Se parte solo: la primera palabra es el nombre y el resto, el apellido.',
  },
  { campo: 'telefono', label: 'Teléfono' },
  { campo: 'email', label: 'Email' },
  { campo: 'estado', label: 'Estado', ayuda: 'Caliente, tibio, frío, ganado o inactivo.' },
  { campo: 'fechaIngreso', label: 'Fecha de ingreso', ayuda: 'Por ejemplo 05/03/2026.' },
  { campo: 'descripcion', label: 'Descripción' },
]

/** A, B, … Z, AA, AB… como las ve el usuario en la planilla. */
function letraDeColumna(indice: number): string {
  let n = indice
  let letra = ''
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letra
}

interface PasoColumnasProps {
  archivo: ArchivoLeido
  mapeo: MapeoColumnas
  onMapeo: (mapeo: MapeoColumnas) => void
  onVolver: () => void
  onContinuar: () => void
  /** Revisando duplicados en la cuenta: no se avanza hasta tener la respuesta. */
  verificando?: boolean
  /** Ya redactado. Si viene, se ofrece reintentar. */
  errorVerificacion?: string | null
}

const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

const BOTON_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

function formatearFecha(fecha: Date | null): string {
  return fecha ? fecha.toLocaleDateString('es-AR') : '—'
}

/** Paso 2: relacionar las columnas del archivo con los datos del lead. */
export function PasoColumnas({
  archivo,
  mapeo,
  onMapeo,
  onVolver,
  onContinuar,
  verificando = false,
  errorVerificacion = null,
}: PasoColumnasProps) {
  const prefijo = useId()
  const hayNombre = mapeoTieneNombre(mapeo)

  const vistaPrevia = useMemo(
    () => normalizarFilas(archivo.filas.slice(0, FILAS_DE_VISTA_PREVIA), mapeo),
    [archivo.filas, mapeo],
  )

  return (
    <section aria-label="Relacionar columnas" className="min-w-0">
      <div className="@container rounded-[16px] border border-border bg-surface p-5">
        <h2 className="m-0 text-[1.05rem] font-bold text-ink">Relacioná tus columnas</h2>
        <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">
          Armamos una propuesta a partir de los títulos. Revisala y corregí lo que haga falta.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 @[40rem]:grid-cols-2">
          {CAMPOS.map(({ campo, label, ayuda }) => {
            const id = `${prefijo}-${campo}`
            const actual = mapeo[campo]
            const falta = !hayNombre && (campo === 'nombre' || campo === 'nombreCompleto')

            return (
              <div key={campo} className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id} className="text-[0.85rem] font-semibold text-ink-2">
                  {label}
                </label>
                <select
                  id={id}
                  value={actual === undefined ? '' : String(actual)}
                  onChange={(e) =>
                    onMapeo(asignarColumna(mapeo, campo, e.target.value === '' ? undefined : Number(e.target.value)))
                  }
                  className={`${CLASES_CONTROL} ${falta ? 'border-peligro-ink' : ''}`}
                >
                  <option value="">No importar</option>
                  {archivo.encabezados.map((encabezado, i) => (
                    <option key={i} value={i}>
                      {letraDeColumna(i)} · {encabezado || '(sin título)'}
                    </option>
                  ))}
                </select>
                {ayuda && <p className="m-0 text-xs text-ink-3">{ayuda}</p>}
              </div>
            )
          })}
        </div>

        {!hayNombre && (
          <p role="alert" className="mt-4 mb-0 text-[0.85rem] text-peligro-ink">
            Elegí la columna de Nombre o la de Nombre completo para poder continuar.
          </p>
        )}

        <p className="mt-4 mb-0 text-xs text-ink-3">
          Si tu planilla trae «Apellido y nombre» en una sola columna, mapeala a Apellido o a Nombre
          según corresponda.
        </p>
      </div>

      <div className="mt-4 rounded-[16px] border border-border bg-surface p-5">
        <h2 className="m-0 text-[1.05rem] font-bold text-ink">Así quedarían las primeras filas</h2>
        <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">
          Mostrando {vistaPrevia.length} de {archivo.filas.length.toLocaleString('es-AR')}.
        </p>

        {/* El scroll es de este contenedor: la página nunca se ensancha. */}
        <div className="mt-3 max-w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[56rem] border-collapse text-left text-[0.85rem]">
            <thead>
              <tr className="bg-surface-2 text-ink-2">
                {['Fila', 'Nombre', 'Apellido', 'Teléfono', 'Email', 'Estado', 'Fecha', 'Avisos'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-xs font-bold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vistaPrevia.map((f) => (
                <tr key={f.fila} className="border-t border-border align-top text-ink">
                  <td className="px-3 py-2 text-ink-3 tabular-nums">{f.fila}</td>
                  <td className="px-3 py-2">{f.nombre || '—'}</td>
                  <td className="px-3 py-2">{f.apellido ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{f.telefono ?? '—'}</td>
                  <td className="px-3 py-2">{f.email ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{f.estado ? etiquetaEstado(f.estado) : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatearFecha(f.fechaIngreso)}</td>
                  <td className="min-w-[16rem] px-3 py-2">
                    {f.errores.length === 0 && f.avisos.length === 0 ? (
                      <span className="text-ink-4">—</span>
                    ) : (
                      <ul className="m-0 list-none space-y-1 p-0 text-xs">
                        {f.errores.map((e) => (
                          <li key={e} className="font-semibold text-peligro-ink">
                            {e}
                          </li>
                        ))}
                        {f.avisos.map((a) => (
                          <li key={a} className="text-badge-tibio-ink">
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {errorVerificacion && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          <p className="m-0">{errorVerificacion}</p>
          <button
            type="button"
            onClick={onContinuar}
            className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-peligro-ink bg-surface px-4 py-2 text-[0.85rem] font-semibold text-peligro-ink hover:bg-peligro-borde focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="@container mt-5">
        <div className="flex flex-col-reverse gap-3 @[28rem]:flex-row @[28rem]:justify-between">
          <button type="button" onClick={onVolver} disabled={verificando} className={BOTON_SECUNDARIO}>
            Volver
          </button>
          <button
            type="button"
            onClick={onContinuar}
            disabled={!hayNombre || verificando}
            aria-busy={verificando}
            className={BOTON_PRIMARIO}
          >
            {verificando ? 'Revisando duplicados en tu cuenta…' : 'Continuar'}
          </button>
        </div>
      </div>
    </section>
  )
}
