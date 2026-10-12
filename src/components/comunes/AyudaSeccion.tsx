import { useEffect, useId, useRef, useState } from 'react'
import { IconoInfo } from '../leads/Iconos'

interface AyudaSeccionProps {
  /** Título de la sección, para nombrar el popover. */
  titulo: string
  texto: string
}

/**
 * "i" con la explicación de una sección.
 *
 * El popover se posiciona contra el ancestro `relative` más cercano (el header
 * de `SeccionCard`) y no contra el ícono: así en un teléfono ocupa el ancho de
 * la card en vez de salirse de la ventana. Se abre con clic o toque, con hover
 * de mouse y con foco de teclado; se cierra con Escape y con clic afuera.
 */
export function AyudaSeccion({ titulo, texto }: AyudaSeccionProps) {
  const [fijo, setFijo] = useState(false)
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const id = useId()
  const abierto = fijo || hover || foco

  useEffect(() => {
    if (!abierto) return
    function cerrarTodo() {
      setFijo(false)
      setHover(false)
      setFoco(false)
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrarTodo()
    }
    function alClickear(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) cerrarTodo()
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alClickear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alClickear)
    }
  }, [abierto])

  return (
    <span
      ref={raiz}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label="Qué significa esta sección"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => setFijo((f) => !f)}
        // Sólo el foco de teclado abre: el de un clic de mouse ya lo resuelve
        // el onClick, y abrir acá lo dejaría abierto y cerrado a la vez.
        onFocus={(e) => setFoco(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFoco(false)}
        className="-my-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--shadow-focus)] motion-reduce:transition-none"
      >
        <IconoInfo className="size-[18px]" />
      </button>

      {abierto && (
        <span
          id={id}
          role="note"
          aria-label={`Criterio de ${titulo}`}
          className="absolute inset-x-0 top-full z-30 mt-1 block max-w-[22rem] rounded-xl border border-border bg-surface px-3.5 py-3 text-[0.8rem] leading-relaxed font-normal text-ink-2 shadow-modal"
        >
          {texto}
        </span>
      )}
    </span>
  )
}
