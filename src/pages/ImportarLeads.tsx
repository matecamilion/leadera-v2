import { useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { IndicadorPasos } from '../components/leads/importar/IndicadorPasos'
import { PasoArchivo } from '../components/leads/importar/PasoArchivo'
import { PasoColumnas } from '../components/leads/importar/PasoColumnas'
import { IconoFlechaAtras } from '../components/leads/Iconos'
import {
  ErrorArchivoImportacion,
  leerArchivo,
  type ArchivoLeido,
} from '../lib/importarLeads/leerArchivo'
import { sugerirMapeo, type MapeoColumnas } from '../lib/importarLeads/mapeoColumnas'

/**
 * Todo el estado vive acá, en memoria: ni localStorage ni el store global.
 * Recargar la página empieza de cero, que es lo que se espera de un archivo.
 */
interface Estado {
  paso: 1 | 2
  leyendo: boolean
  error: string | null
  nombreArchivo: string | null
  archivo: ArchivoLeido | null
  mapeo: MapeoColumnas
  /** El paso 3 todavía no existe: "Continuar" del paso 2 solo avisa. */
  avisoSiguiente: boolean
}

type Accion =
  | { tipo: 'leyendo' }
  | { tipo: 'cargado'; nombre: string; archivo: ArchivoLeido }
  | { tipo: 'fallo'; mensaje: string }
  | { tipo: 'quitar' }
  | { tipo: 'paso'; paso: 1 | 2 }
  | { tipo: 'mapear'; mapeo: MapeoColumnas }
  | { tipo: 'continuar' }

const INICIAL: Estado = {
  paso: 1,
  leyendo: false,
  error: null,
  nombreArchivo: null,
  archivo: null,
  mapeo: {},
  avisoSiguiente: false,
}

function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case 'leyendo':
      return { ...estado, leyendo: true, error: null }
    case 'cargado':
      return {
        ...INICIAL,
        nombreArchivo: accion.nombre,
        archivo: accion.archivo,
        // Un archivo nuevo arranca con la propuesta de columnas, no con la del anterior.
        mapeo: sugerirMapeo(accion.archivo.encabezados).mapeo,
      }
    case 'fallo':
      // Un archivo que no se pudo leer no pisa el que ya estaba cargado.
      return { ...estado, leyendo: false, error: accion.mensaje }
    case 'quitar':
      return INICIAL
    case 'paso':
      return { ...estado, paso: accion.paso, avisoSiguiente: false }
    case 'mapear':
      return { ...estado, mapeo: accion.mapeo, avisoSiguiente: false }
    case 'continuar':
      return { ...estado, avisoSiguiente: true }
  }
}

export default function ImportarLeads() {
  const [estado, dispatch] = useReducer(reducir, INICIAL)
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false)
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null)

  async function elegirArchivo(archivo: File) {
    dispatch({ tipo: 'leyendo' })
    try {
      const leido = await leerArchivo(archivo)
      dispatch({ tipo: 'cargado', nombre: archivo.name, archivo: leido })
    } catch (e) {
      // Los de lectura ya vienen redactados para el usuario; cualquier otro no se muestra.
      dispatch({
        tipo: 'fallo',
        mensaje:
          e instanceof ErrorArchivoImportacion
            ? e.message
            : 'No pudimos leer el archivo. Revisá que no esté dañado e intentá de nuevo.',
      })
    }
  }

  async function bajarPlantilla() {
    setDescargandoPlantilla(true)
    setErrorPlantilla(null)
    try {
      // Dinámico: `exceljs` es pesado y casi nadie baja la plantilla.
      const { descargarPlantillaImportacion } = await import('../lib/plantillaImportacion')
      await descargarPlantillaImportacion()
    } catch {
      setErrorPlantilla('No pudimos generar la plantilla. Probá de nuevo.')
    } finally {
      setDescargandoPlantilla(false)
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-[960px] text-ink">
      <header className="mb-4 md:mb-6">
        <Link
          to="/leads"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-[0.85rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-0"
        >
          <IconoFlechaAtras className="size-4" />
          Volver a Leads
        </Link>
        <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Gestión de leads
        </p>
        <h1 className="m-0 text-[2rem] leading-tight font-bold text-ink">Importar leads</h1>
        <p className="mt-1 mb-0 text-[0.9rem] text-ink-3">Traé tus contactos desde Excel o CSV.</p>
      </header>

      <IndicadorPasos actual={estado.paso} />

      {errorPlantilla && (
        <p role="alert" className="mb-4 text-[0.85rem] text-peligro-ink">
          {errorPlantilla}
        </p>
      )}

      {estado.paso === 1 || !estado.archivo ? (
        <PasoArchivo
          archivo={estado.archivo}
          nombreArchivo={estado.nombreArchivo}
          leyendo={estado.leyendo}
          error={estado.error}
          onElegir={elegirArchivo}
          onQuitar={() => dispatch({ tipo: 'quitar' })}
          onContinuar={() => dispatch({ tipo: 'paso', paso: 2 })}
          onDescargarPlantilla={bajarPlantilla}
          descargandoPlantilla={descargandoPlantilla}
        />
      ) : (
        <>
          <PasoColumnas
            archivo={estado.archivo}
            mapeo={estado.mapeo}
            onMapeo={(mapeo) => dispatch({ tipo: 'mapear', mapeo })}
            onVolver={() => dispatch({ tipo: 'paso', paso: 1 })}
            onContinuar={() => dispatch({ tipo: 'continuar' })}
          />
          {estado.avisoSiguiente && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[0.85rem] text-ink-2"
            >
              Siguiente etapa en construcción.
            </p>
          )}
        </>
      )}
    </div>
  )
}
