import { useEffect, useRef } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { FichaPropiedadPDF, type DatosFicha } from './FichaPropiedadPDF'

/** "Av. Colón 1234, Mar del Plata" -> "av-colon-1234-mar-del-plata" */
function slugificar(texto: string): string {
  // NFD separa la letra de su tilde; el rango son los diacríticos sueltos.
  const sinAcentos = texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const slug = sinAcentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'propiedad'
}

interface Props {
  propiedad: DatosFicha
  /** La ficha ya se descargó. Quien la montó la desmonta. */
  onTerminado: () => void
  onError: () => void
}

/**
 * Arma y descarga la ficha en PDF. No dibuja nada: el botón vive en el menú
 * "Compartir" de la cabecera.
 *
 * Se monta recién cuando alguien pide la ficha, y `usePDF` arranca con el
 * documento al montar: así no se genera nada hasta ese momento, y el chunk
 * de @react-pdf/renderer se baja sólo entonces. Cada pedido es un montaje
 * nuevo, así que la ficha sale con los datos de ahora.
 */
export function BotonExportarFicha({ propiedad, onTerminado, onError }: Props) {
  const [instancia] = usePDF({ document: <FichaPropiedadPDF propiedad={propiedad} /> })
  // La URL que ya se descargó, para no volver a disparar la bajada en cada
  // re-render mientras la instancia siga viva.
  const descargada = useRef<string | null>(null)

  const nombreArchivo = `ficha-${slugificar(propiedad.direccion)}.pdf`

  useEffect(() => {
    if (instancia.error) {
      onError()
      return
    }
    if (instancia.loading || !instancia.url) return
    if (descargada.current === instancia.url) return

    descargada.current = instancia.url
    const ancla = document.createElement('a')
    ancla.href = instancia.url
    ancla.download = nombreArchivo
    document.body.appendChild(ancla)
    ancla.click()
    ancla.remove()
    onTerminado()
  }, [instancia.error, instancia.loading, instancia.url, nombreArchivo, onError, onTerminado])

  return null
}

export default BotonExportarFicha
