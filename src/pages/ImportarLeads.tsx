import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { INICIAL, reducir } from '../components/leads/importar/estadoImportacion'
import { IndicadorPasos } from '../components/leads/importar/IndicadorPasos'
import { PasoArchivo } from '../components/leads/importar/PasoArchivo'
import { PasoColumnas } from '../components/leads/importar/PasoColumnas'
import { PasoResultado } from '../components/leads/importar/PasoResultado'
import { PasoRevision } from '../components/leads/importar/PasoRevision'
import { prepararRevision } from '../components/leads/importar/revisar'
import { IconoFlechaAtras } from '../components/leads/Iconos'
import { useImportarLeads } from '../hooks/useImportarLeads'
import { armarPayload } from '../lib/api/importarLeads'
import { ErrorArchivoImportacion, leerArchivo } from '../lib/importarLeads/leerArchivo'

const ERROR_DE_VERIFICACION = 'No pudimos revisar tu cuenta. Probá de nuevo.'

export default function ImportarLeads() {
  const navigate = useNavigate()
  const [estado, dispatch] = useReducer(reducir, INICIAL)
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false)
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null)
  const importar = useImportarLeads()

  // Guardas síncronas: `dispatch` no alcanza para frenar un segundo toque que
  // llega antes del siguiente render.
  const verificandoRef = useRef(false)
  const importandoRef = useRef(false)

  // Mientras se importa, cerrar la pestaña corta el proceso a mitad de camino.
  useEffect(() => {
    if (!estado.importando) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [estado.importando])

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

  /** Paso 2 → 3: nunca se avanza sin la respuesta de la cuenta. */
  async function revisar() {
    if (!estado.archivo || verificandoRef.current) return
    verificandoRef.current = true
    dispatch({ tipo: 'verificando' })
    try {
      dispatch({ tipo: 'verificado', revision: await prepararRevision(estado.archivo, estado.mapeo) })
    } catch (e) {
      dispatch({ tipo: 'fallaVerificacion', mensaje: e instanceof Error && e.message ? e.message : ERROR_DE_VERIFICACION })
    } finally {
      verificandoRef.current = false
    }
  }

  /** Paso 3 → 4: importa de verdad. Una sola vez. */
  async function confirmarImportacion() {
    const revision = estado.revision
    if (!revision || importandoRef.current) return
    importandoRef.current = true

    const payload = armarPayload(revision.clasificacion.aImportar)
    dispatch({ tipo: 'importar', total: payload.length })
    try {
      const resultado = await importar.mutateAsync({
        filas: payload,
        onProgreso: (procesadas, total) => dispatch({ tipo: 'progreso', procesadas, total }),
      })
      dispatch({ tipo: 'terminado', resultado })
    } catch {
      // `importarLeads` no lanza; esto es por si algo se rompe fuera de la llamada.
      dispatch({
        tipo: 'terminado',
        resultado: {
          insertados: 0,
          resultados: [],
          corte: {
            mensaje: 'Ocurrió un error inesperado.',
            filasSinProcesar: payload.map((f) => f.fila),
          },
        },
      })
    } finally {
      importandoRef.current = false
    }
  }

  function reiniciar() {
    importar.reset()
    dispatch({ tipo: 'reiniciar' })
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

      <IndicadorPasos actual={estado.paso} habilitados={4} />

      {errorPlantilla && (
        <p role="alert" className="mb-4 text-[0.85rem] text-peligro-ink">
          {errorPlantilla}
        </p>
      )}

      {estado.paso === 4 && estado.revision ? (
        <PasoResultado
          revision={estado.revision}
          importando={estado.importando}
          progreso={estado.progreso}
          resultado={estado.resultado}
          onVerLeads={() => navigate('/leads')}
          onOtroArchivo={reiniciar}
        />
      ) : estado.paso === 3 && estado.revision ? (
        <PasoRevision
          revision={estado.revision}
          onVolver={() => dispatch({ tipo: 'paso', paso: 2 })}
          onImportar={confirmarImportacion}
        />
      ) : estado.paso === 2 && estado.archivo ? (
        <PasoColumnas
          archivo={estado.archivo}
          mapeo={estado.mapeo}
          onMapeo={(mapeo) => dispatch({ tipo: 'mapear', mapeo })}
          onVolver={() => dispatch({ tipo: 'paso', paso: 1 })}
          onContinuar={revisar}
          verificando={estado.verificando}
          errorVerificacion={estado.errorVerificacion}
        />
      ) : (
        <PasoArchivo
          archivo={estado.archivo}
          nombreArchivo={estado.nombreArchivo}
          leyendo={estado.leyendo}
          error={estado.error}
          onElegir={elegirArchivo}
          onQuitar={() => dispatch({ tipo: 'reiniciar' })}
          onContinuar={() => dispatch({ tipo: 'paso', paso: 2 })}
          onDescargarPlantilla={bajarPlantilla}
          descargandoPlantilla={descargandoPlantilla}
        />
      )}
    </div>
  )
}
