import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

export interface ItemMenu {
  label: string
  icono?: ReactNode
  /** Con `to` el ítem es un link; sin él, un botón que corre `onSelect`. */
  to?: string
  onSelect?: () => void
}

interface MenuDesplegableProps {
  /** Lo que se ve en el botón que abre el menú. */
  boton: ReactNode
  /** Clases del botón: cada uso tiene su look. */
  claseBoton: string
  /** Nombre accesible del botón, si su contenido no alcanza. */
  etiqueta?: string
  items: ItemMenu[]
  /** Contenido fijo arriba de los ítems (p. ej., el nombre y el mail). No es foco. */
  encabezado?: ReactNode
  /** De qué lado del botón se alinea el panel. */
  alinear?: 'izquierda' | 'derecha'
}

const CLASE_ITEM =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[0.88rem] font-medium text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink focus-visible:bg-surface-muted focus-visible:text-ink focus-visible:outline-none motion-reduce:transition-none'

/**
 * Menú desplegable accesible (patrón "menu button" de WAI-ARIA).
 *
 * - El botón lleva `aria-haspopup="menu"` y `aria-expanded`.
 * - Al abrir, el foco va al primer ítem; flechas arriba/abajo, Home y End
 *   recorren los ítems.
 * - Escape cierra y devuelve el foco al botón. Tab cierra y deja que el foco
 *   siga su camino. Un clic afuera también cierra.
 */
export function MenuDesplegable({
  boton,
  claseBoton,
  etiqueta,
  items,
  encabezado,
  alinear = 'izquierda',
}: MenuDesplegableProps) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const itemsRef = useRef<(HTMLElement | null)[]>([])

  // Al abrir, foco al primer ítem.
  useEffect(() => {
    if (abierto) itemsRef.current[0]?.focus()
  }, [abierto])

  // Clic afuera cierra.
  useEffect(() => {
    if (!abierto) return
    function alClickear(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [abierto])

  function cerrar(devolverFoco: boolean) {
    setAbierto(false)
    if (devolverFoco) botonRef.current?.focus()
  }

  function moverFoco(desde: number, paso: number) {
    const n = items.length
    itemsRef.current[(desde + paso + n) % n]?.focus()
  }

  function teclaEnMenu(e: KeyboardEvent<HTMLDivElement>) {
    const actual = itemsRef.current.findIndex((el) => el === document.activeElement)
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        cerrar(true)
        break
      case 'Tab':
        cerrar(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        moverFoco(actual, 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moverFoco(actual === -1 ? 0 : actual, -1)
        break
      case 'Home':
        e.preventDefault()
        itemsRef.current[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        itemsRef.current[items.length - 1]?.focus()
        break
    }
  }

  function teclaEnBoton(e: KeyboardEvent<HTMLButtonElement>) {
    // Flecha abajo con el menú cerrado también lo abre, como en un menú nativo.
    if (e.key === 'ArrowDown' && !abierto) {
      e.preventDefault()
      setAbierto(true)
    }
  }

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-menu` : undefined}
        aria-label={etiqueta}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={teclaEnBoton}
        className={claseBoton}
      >
        {boton}
      </button>

      {abierto && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-label={etiqueta}
          onKeyDown={teclaEnMenu}
          className={`absolute top-full z-50 mt-1.5 min-w-[13rem] rounded-xl border border-border bg-surface p-1.5 shadow-modal ${
            alinear === 'derecha' ? 'right-0' : 'left-0'
          }`}
        >
          {encabezado && (
            <div className="mb-1 border-b border-border px-3 pt-1.5 pb-2.5">{encabezado}</div>
          )}
          {items.map((item, i) =>
            item.to ? (
              <Link
                key={item.label}
                ref={(el) => {
                  itemsRef.current[i] = el
                }}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  item.onSelect?.()
                  cerrar(false)
                }}
                className={CLASE_ITEM}
              >
                {item.icono}
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                ref={(el) => {
                  itemsRef.current[i] = el
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  cerrar(false)
                  item.onSelect?.()
                }}
                className={CLASE_ITEM}
              >
                {item.icono}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
