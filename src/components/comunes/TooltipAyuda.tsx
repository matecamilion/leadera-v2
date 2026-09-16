import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { IconoAyuda } from '../leads/Iconos'

/**
 * Ícono "?" con una explicación corta al lado.
 *
 * No hay librería de tooltips en el proyecto —ni Radix ni headless— y el único
 * `Tooltip` que existe es interno de `GraficoEvolucion`, atado al hover sobre un
 * SVG y a su sistema de coordenadas. Este es el de ayuda contextual y es otra
 * cosa, así que va aparte en vez de forzar aquel.
 *
 * Interacción: abre con click/tap y con Enter o Espacio —es un `<button>`, así
 * que el teclado lo alcanza solo— y además con hover cuando el puntero es un
 * mouse. Deliberadamente NO abre con `onFocus`: el foco llega también al
 * clickear, y entre `onFocus` abriendo y `onClick` alternando el globo se
 * cerraba en el mismo gesto que lo abría. Cierra con Escape, con un click
 * afuera, o al scrollear.
 *
 * El globo se posiciona con `position: fixed` y no `absolute` porque varios de
 * sus contenedores tienen `overflow-hidden` —la columna de identidad de
 * `ResumenLead`, por ejemplo—, y ahí un absoluto queda recortado justo cuando
 * se abre. Con fixed sale del flujo y se ubica contra la ventana.
 *
 * El ícono va en `text-ink-4` y no en el verde de marca a propósito: es ayuda
 * opcional y no tiene que competir con los CTA de la pantalla.
 */

/** Ancho máximo del globo. Acotado para que el texto se lea de un vistazo. */
const ANCHO_MAX = 280
/** Aire entre el ícono y el globo. */
const SEPARACION = 8
/** Margen mínimo contra los bordes de la ventana. */
const MARGEN = 12

interface TooltipAyudaProps {
  /**
   * Qué se está explicando, en minúscula y sin artículo inicial: arma el
   * `aria-label` como "Ayuda sobre {etiqueta}". Sin esto el botón se anunciaría
   * como "?" a secas, que no le dice nada a quien usa lector de pantalla.
   */
  etiqueta: string
  children: ReactNode
}

export function TooltipAyuda({ etiqueta, children }: TooltipAyudaProps) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const globoRef = useRef<HTMLDivElement>(null)

  /**
   * Abrir limpia la posición vieja acá y no dentro del efecto.
   *
   * Si la limpieza viviera en el efecto haría falta un setState sincrónico en
   * la rama de cerrado, que encadena un render de más —y el linter lo marca—.
   * Hecho en el gesto que abre, el globo tampoco llega a pintarse un frame con
   * las coordenadas de la vez anterior.
   */
  const abrir = () => {
    setPos(null)
    setAbierto(true)
  }

  const cerrar = () => setAbierto(false)

  // Se mide después de pintar y antes de que el navegador lo muestre: hasta que
  // hay posición el globo va invisible, así no se ve saltar de la esquina al
  // lugar que le toca.
  useLayoutEffect(() => {
    if (!abierto) return

    const boton = botonRef.current
    const globo = globoRef.current
    if (!boton || !globo) return

    const r = boton.getBoundingClientRect()
    const g = globo.getBoundingClientRect()

    // Debajo del ícono por defecto. Si abajo no entra, va arriba: el objetivo
    // es no tapar lo que se está explicando, que casi siempre está al lado.
    let top = r.bottom + SEPARACION
    if (top + g.height > window.innerHeight - MARGEN) {
      top = Math.max(MARGEN, r.top - g.height - SEPARACION)
    }

    // Centrado sobre el ícono y recortado contra los bordes, para que en un
    // teléfono no se salga de pantalla.
    const centrado = r.left + r.width / 2 - g.width / 2
    const left = Math.min(
      Math.max(MARGEN, centrado),
      Math.max(MARGEN, window.innerWidth - g.width - MARGEN),
    )

    setPos({ top, left })
  }, [abierto])

  useEffect(() => {
    if (!abierto) return

    // Local y con otro nombre que el `cerrar` de arriba: así el efecto no
    // depende de nada de afuera y no hay identificador pisado.
    const cerrarPorGesto = () => setAbierto(false)

    const porTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }

    const porClickAfuera = (e: PointerEvent) => {
      const destino = e.target as Node
      if (botonRef.current?.contains(destino)) return
      if (globoRef.current?.contains(destino)) return
      setAbierto(false)
    }

    document.addEventListener('keydown', porTecla)
    document.addEventListener('pointerdown', porClickAfuera)
    // En captura: el scroll de un contenedor interno no burbujea hasta window.
    // Se cierra en vez de reposicionar porque la posición es fija y quedaría
    // flotando lejos del ícono.
    window.addEventListener('scroll', cerrarPorGesto, true)
    window.addEventListener('resize', cerrarPorGesto)

    return () => {
      document.removeEventListener('keydown', porTecla)
      document.removeEventListener('pointerdown', porClickAfuera)
      window.removeEventListener('scroll', cerrarPorGesto, true)
      window.removeEventListener('resize', cerrarPorGesto)
    }
  }, [abierto])

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-label={`Ayuda sobre ${etiqueta}`}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        // Sólo con mouse: en touch el pointerenter llega junto con el tap y
        // abriría y cerraría de una.
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') abrir()
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') cerrar()
        }}
        className="inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-ink-4 transition-colors hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <IconoAyuda className="size-4" />
      </button>

      {abierto && (
        <div
          ref={globoRef}
          id={id}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            maxWidth: ANCHO_MAX,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-50 rounded-md bg-ink px-3 py-2 text-[0.8rem] leading-relaxed text-white shadow-modal"
        >
          {children}
        </div>
      )}
    </>
  )
}
