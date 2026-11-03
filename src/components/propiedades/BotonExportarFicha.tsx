import { useEffect } from 'react'
import { pdf } from '@react-pdf/renderer'
import { FichaPropiedadPDF } from './FichaPropiedadPDF'
import type { DatosFicha } from './ficha/datos'
import { resolverAcento } from './ficha/diseno'
import { registrarFuentes } from './ficha/fuentes'
import { prepararFotosFicha } from './ficha/fotos'

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
 * Se monta recién cuando alguien pide la ficha, así que no se genera nada
 * hasta ese momento y el chunk de @react-pdf/renderer se baja sólo entonces.
 * Cada pedido es un montaje nuevo: la ficha sale con los datos de ahora.
 *
 * Antes de armar el PDF se bajan y reducen las fotos (una foto rota se
 * descarta sin cancelar nada); recién con ellas listas se genera el documento.
 */
export function BotonExportarFicha({ propiedad, onTerminado, onError }: Props) {
  useEffect(() => {
    let cancelado = false

    async function exportar() {
      try {
        registrarFuentes()
        const fotos = await prepararFotosFicha(propiedad.fotos_urls)
        if (cancelado) return

        const blob = await pdf(
          <FichaPropiedadPDF propiedad={propiedad} fotos={fotos} acento={resolverAcento()} />,
        ).toBlob()
        if (cancelado) return

        const url = URL.createObjectURL(blob)
        const ancla = document.createElement('a')
        ancla.href = url
        ancla.download = `ficha-${slugificar(propiedad.direccion)}.pdf`
        document.body.appendChild(ancla)
        ancla.click()
        ancla.remove()
        // El navegador ya tomó el archivo; se suelta un poco después por si el click es asíncrono.
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        onTerminado()
      } catch {
        if (!cancelado) onError()
      }
    }

    void exportar()
    return () => {
      cancelado = true
    }
    // Un montaje, un pedido: los datos no cambian mientras la ficha se arma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default BotonExportarFicha
