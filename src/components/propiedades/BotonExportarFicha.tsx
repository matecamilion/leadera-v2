import { useEffect, useRef, useState } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { FichaPropiedadPDF, type DatosFicha } from './FichaPropiedadPDF'

/** "Av. Colón 1234, Mar del Plata" -> "av-colon-1234-mar-del-plata" */
function slugificar(texto: string): string {
  // NFD separa la letra de su tilde; el rango son los diacríticos sueltos.
  const sinAcentos = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const slug = sinAcentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'propiedad'
}

/**
 * Descarga la ficha en PDF.
 *
 * `usePDF` arranca sin documento a propósito: así no se genera nada hasta que
 * el usuario hace click. Con `PDFDownloadLink` el render arranca al montar el
 * componente, y armar un PDF con fotos en cada visita al detalle sería tirar
 * red y CPU por una acción que casi nunca se usa.
 */
export function BotonExportarFicha({ propiedad }: { propiedad: DatosFicha }) {
  const [instancia, actualizar] = usePDF()
  const [pedido, setPedido] = useState(false)
  // La URL que ya se descargó, para no volver a disparar la bajada en cada
  // re-render mientras la instancia siga viva.
  const descargada = useRef<string | null>(null)

  const nombreArchivo = `ficha-${slugificar(propiedad.direccion)}.pdf`

  useEffect(() => {
    if (!pedido || instancia.loading || !instancia.url) return
    if (descargada.current === instancia.url) return

    descargada.current = instancia.url
    const ancla = document.createElement('a')
    ancla.href = instancia.url
    ancla.download = nombreArchivo
    document.body.appendChild(ancla)
    ancla.click()
    ancla.remove()
    setPedido(false)
  }, [pedido, instancia.loading, instancia.url, nombreArchivo])

  function exportar() {
    setPedido(true)
    // Se rearma el documento en cada click: si la propiedad cambió mientras
    // la página seguía abierta, la ficha sale con los datos de ahora.
    descargada.current = null
    actualizar(<FichaPropiedadPDF propiedad={propiedad} />)
  }

  const generando = pedido && !instancia.error

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <button
        type="button"
        onClick={exportar}
        disabled={generando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
      >
        <IconoDescarga className="size-4" />
        {generando ? 'Generando ficha…' : 'Exportar ficha'}
      </button>

      {instancia.error && (
        <p role="alert" className="text-[0.75rem] text-peligro-ink">
          No se pudo generar la ficha. Probá de nuevo.
        </p>
      )}
    </div>
  )
}

function IconoDescarga({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export default BotonExportarFicha
