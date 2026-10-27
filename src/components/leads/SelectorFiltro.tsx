import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { IconoCheck, IconoChevronAbajo } from './Iconos'

export interface OpcionFiltro<V extends string> {
  valor: V
  label: string
}

interface SelectorFiltroProps<V extends string> {
  /** Lo que aparece delante del valor: "Tipo", "Ordenar". Siempre visible. */
  etiqueta: string
  valor: V
  opciones: OpcionFiltro<V>[]
  onCambiar: (valor: V) => void
  /** Hay un filtro aplicado (valor distinto del default): borde y texto en primario. */
  destacado?: boolean
  className?: string
}

/**
 * Desplegable de un solo valor: patrón "select-only combobox" de WAI-ARIA.
 *
 * El foco se queda siempre en el botón; la opción activa se anuncia con
 * `aria-activedescendant`. No reutiliza `MenuDesplegable`: ese es un menú de
 * acciones (el foco salta a cada ítem) y acá se elige un valor.
 *
 * - Cerrado: flecha arriba/abajo, Enter, Espacio, Home y End abren.
 * - Abierto: flechas, Home y End mueven la opción activa; Enter o Espacio la
 *   eligen; Escape cierra; Tab cierra y sigue; un clic afuera cierra.
 */
export function SelectorFiltro<V extends string>({
  etiqueta,
  valor,
  opciones,
  onCambiar,
  destacado = false,
  className = '',
}: SelectorFiltroProps<V>) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(0)
  // Si el panel, alineado al borde izquierdo del botón, se sale de la pantalla,
  // se alinea al derecho.
  const [alDerecha, setAlDerecha] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLUListElement>(null)

  const indiceSeleccionada = Math.max(
    0,
    opciones.findIndex((o) => o.valor === valor),
  )
  const seleccionada = opciones[indiceSeleccionada]

  useLayoutEffect(() => {
    if (!abierto) return
    const caja = panel.current?.getBoundingClientRect()
    setAlDerecha(!!caja && caja.right > window.innerWidth - 8)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    function alClickear(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [abierto])

  function abrir(en = indiceSeleccionada) {
    setActiva(en)
    setAlDerecha(false)
    setAbierto(true)
  }

  function elegir(i: number) {
    setAbierto(false)
    if (opciones[i].valor !== valor) onCambiar(opciones[i].valor)
  }

  function tecla(e: KeyboardEvent<HTMLButtonElement>) {
    const ultima = opciones.length - 1
    if (!abierto) {
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
          e.preventDefault()
          abrir()
          break
        case 'Home':
          e.preventDefault()
          abrir(0)
          break
        case 'End':
          e.preventDefault()
          abrir(ultima)
          break
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiva((a) => Math.min(a + 1, ultima))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiva((a) => Math.max(a - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActiva(0)
        break
      case 'End':
        e.preventDefault()
        setActiva(ultima)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        elegir(activa)
        break
      case 'Escape':
        e.preventDefault()
        setAbierto(false)
        break
      case 'Tab':
        setAbierto(false)
        break
    }
  }

  return (
    <div ref={raiz} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-labelledby={`${id}-etiqueta ${id}-valor`}
        aria-activedescendant={abierto ? `${id}-op-${activa}` : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={tecla}
        // Espacio dispara el clic al soltar; ya se atendió en keydown.
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        className={[
          'flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-surface pr-2.5 pl-3 text-left text-[0.85rem] transition-colors motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          destacado ? 'border-primary text-primary' : 'border-border text-ink-3 hover:bg-background',
        ].join(' ')}
      >
        <span id={`${id}-etiqueta`} className="shrink-0">
          {etiqueta}
        </span>
        <span
          id={`${id}-valor`}
          className={`min-w-0 flex-1 truncate font-semibold ${destacado ? 'text-primary' : 'text-ink'}`}
        >
          {seleccionada?.label}
        </span>
        <IconoChevronAbajo
          className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <ul
          ref={panel}
          id={`${id}-lista`}
          role="listbox"
          aria-labelledby={`${id}-etiqueta`}
          className={`absolute top-full z-50 mt-1.5 m-0 w-max max-w-[calc(100vw-2rem)] min-w-full list-none rounded-xl border border-border bg-surface p-1.5 shadow-modal ${
            alDerecha ? 'right-0' : 'left-0'
          }`}
        >
          {opciones.map((o, i) => {
            const elegida = o.valor === valor
            return (
              <li
                key={o.valor}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={elegida}
                // Sin esto el mousedown le saca el foco al botón.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiva(i)}
                onClick={() => elegir(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-[0.88rem] whitespace-nowrap ${
                  elegida ? 'font-semibold text-primary' : 'font-medium text-ink-2'
                } ${i === activa ? 'bg-surface-muted' : ''}`}
              >
                {o.label}
                {elegida && <IconoCheck className="size-4 shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
