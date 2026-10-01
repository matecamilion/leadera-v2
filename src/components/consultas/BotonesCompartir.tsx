import { useEffect, useRef, useState } from 'react'
import { compartirLink, copiarTexto, puedeCompartir } from './compartir'

function IconoCopiar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

function IconoCompartir() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

function IconoTilde() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

const CLASE_BOTON_COMPARTIR =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.86rem] font-semibold transition-colors disabled:opacity-60 motion-reduce:transition-none sm:min-h-[38px]'

/**
 * [Copiar] y [Compartir]. Copiar copia solo el link (es lo que va en la bio);
 * Compartir abre la hoja del teléfono con el texto y el link, y donde no hay
 * hoja de compartir el botón no aparece y Copiar ocupa su lugar.
 *
 * `ancho`: en mobile los dos botones se reparten el ancho de la fila.
 */
export function BotonesCompartir({
  url,
  titulo,
  texto,
  ancho = false,
}: {
  url: string
  titulo: string
  texto: string
  ancho?: boolean
}) {
  const [aviso, setAviso] = useState<string | null>(null)
  const temporizador = useRef<number | undefined>(undefined)
  // Se decide una vez: no cambia mientras la pantalla está abierta.
  const [conCompartir] = useState(puedeCompartir)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  function avisar(texto: string) {
    setAviso(texto)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setAviso(null), 2000)
  }

  async function copiar() {
    avisar((await copiarTexto(url)) ? 'Copiado' : 'No se pudo copiar')
  }

  async function compartir() {
    const r = await compartirLink({ titulo, texto, url })
    if (r === 'copiado') avisar('Copiado')
    else if (r === 'fallo') avisar('No se pudo compartir')
  }

  const copiado = aviso === 'Copiado'

  return (
    <div className={`flex items-center gap-2 ${ancho ? 'w-full sm:w-auto' : ''}`}>
      <button
        type="button"
        onClick={copiar}
        className={[
          CLASE_BOTON_COMPARTIR,
          ancho ? 'flex-1 sm:flex-none' : '',
          copiado
            ? 'border-primary bg-brand-soft text-primary-dark'
            : 'border-border bg-surface text-ink-2 hover:border-primary/50 hover:text-primary',
        ].join(' ')}
      >
        {copiado ? <IconoTilde /> : <IconoCopiar />}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
      {conCompartir && (
        <button
          type="button"
          onClick={compartir}
          className={`${CLASE_BOTON_COMPARTIR} ${ancho ? 'flex-1 sm:flex-none' : ''} border-primary bg-primary text-primary-contrast hover:bg-primary-hover`}
        >
          <IconoCompartir />
          Compartir
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {aviso ?? ''}
      </span>
      {aviso && !copiado && <span className="text-[0.78rem] text-peligro-ink">{aviso}</span>}
    </div>
  )
}
