import { useId, useRef, useState, type DragEvent } from 'react'
import { MAX_BYTES_ARCHIVO, MAX_FILAS_ARCHIVO, type ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import { EstadoError } from '../../comunes/EstadoError'
import { IconoCheck, IconoTabla } from '../Iconos'

const MB = MAX_BYTES_ARCHIVO / (1024 * 1024)

interface PasoArchivoProps {
  archivo: ArchivoLeido | null
  nombreArchivo: string | null
  leyendo: boolean
  /** Ya redactado para el usuario. */
  error: string | null
  onElegir: (archivo: File) => void
  onQuitar: () => void
  onContinuar: () => void
  onDescargarPlantilla: () => void
  descargandoPlantilla: boolean
}

const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

const BOTON_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

/** Paso 1: elegir (o arrastrar) el .xlsx o .csv. */
export function PasoArchivo({
  archivo,
  nombreArchivo,
  leyendo,
  error,
  onElegir,
  onQuitar,
  onContinuar,
  onDescargarPlantilla,
  descargandoPlantilla,
}: PasoArchivoProps) {
  const idInput = useId()
  const ref = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)

  function alSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    if (leyendo) return
    const primero = e.dataTransfer.files?.[0]
    if (primero) onElegir(primero)
  }

  return (
    <section aria-label="Elegir archivo" className="min-w-0">
      {error && (
        <div className="mb-4">
          <EstadoError titulo="No pudimos leer el archivo" mensaje={error} />
        </div>
      )}

      {archivo && nombreArchivo ? (
        <div className="@container rounded-[16px] border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary"
            >
              <IconoCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[0.95rem] font-bold break-words text-ink">{nombreArchivo}</p>
              <p className="m-0 mt-1 text-[0.85rem] text-ink-3">
                {archivo.hoja !== null && <>Hoja: {archivo.hoja} · </>}
                {archivo.filas.length.toLocaleString('es-AR')}{' '}
                {archivo.filas.length === 1 ? 'fila' : 'filas'} con datos ·{' '}
                {archivo.encabezados.length} {archivo.encabezados.length === 1 ? 'columna' : 'columnas'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 @[28rem]:flex-row @[28rem]:justify-between">
            <button type="button" onClick={onQuitar} className={BOTON_SECUNDARIO}>
              Elegir otro archivo
            </button>
            <button type="button" onClick={onContinuar} className={BOTON_PRIMARIO}>
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!leyendo) setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={`rounded-[16px] border border-dashed px-5 py-10 text-center transition-colors motion-reduce:transition-none ${
            arrastrando ? 'border-primary bg-brand-softer' : 'border-border bg-surface'
          }`}
        >
          <span
            aria-hidden
            className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-primary"
          >
            <IconoTabla className="size-6" />
          </span>
          <h2 className="m-0 text-[1.05rem] font-bold text-ink">
            {leyendo ? 'Leyendo el archivo…' : 'Arrastrá tu archivo acá'}
          </h2>
          <p className="mx-auto mt-1.5 mb-0 max-w-[48ch] text-[0.9rem] text-ink-3">
            Excel (.xlsx) o CSV, hasta {MB} MB y {MAX_FILAS_ARCHIVO.toLocaleString('es-AR')} filas.
          </p>

          <input
            ref={ref}
            id={idInput}
            type="file"
            accept=".xlsx,.csv"
            disabled={leyendo}
            className="peer sr-only"
            onChange={(e) => {
              const elegido = e.target.files?.[0]
              e.target.value = '' // permite volver a elegir el mismo archivo
              if (elegido) onElegir(elegido)
            }}
          />
          <label
            htmlFor={idInput}
            aria-busy={leyendo}
            className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary motion-reduce:transition-none ${
              leyendo ? 'cursor-wait opacity-55' : 'cursor-pointer hover:bg-primary-dark'
            }`}
          >
            Elegir archivo
          </label>
        </div>
      )}

      <div className="mt-4 text-[0.85rem] text-ink-3">
        <p className="m-0">
          Sirve cualquier archivo con sus propias columnas; en el siguiente paso las relacionás.
        </p>
        <p className="mt-1 mb-0">
          ¿Preferís arrancar de una plantilla?{' '}
          <button
            type="button"
            onClick={onDescargarPlantilla}
            disabled={descargandoPlantilla}
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-55"
          >
            {descargandoPlantilla ? 'Descargando…' : 'Descargar plantilla'}
          </button>
        </p>
      </div>
    </section>
  )
}
