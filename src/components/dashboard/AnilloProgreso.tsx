import type { ReactNode } from 'react'

// Misma geometría que el anillo de `MetaMensual`: viewBox de 160, radio 64 y
// trazo de 12. Acá se dibuja más chico escalando el SVG, no cambiando los
// números, así el grosor queda en la misma proporción.
const RADIO = 64
const CIRCUNFERENCIA = 2 * Math.PI * RADIO
const CENTRO = 80
/** Cuánto sobresale la marca de ritmo a cada lado del trazo. */
const LARGO_MARCA = 10

/**
 * Tamaños del anillo. Mismo viewBox en los dos: el grande sólo escala el SVG,
 * así trazo y marca quedan en la misma proporción. Los números de adentro
 * crecen en la misma medida (~1,3x) para no quedar chicos en el centro.
 */
const TAMANOS = {
  normal: {
    svg: 'size-[84px] sm:size-[112px]',
    valor: 'text-[1.15rem] sm:text-[1.4rem]',
    meta: 'text-[0.8rem] sm:text-[0.9rem]',
  },
  grande: {
    svg: 'size-[112px] sm:size-[150px]',
    valor: 'text-[1.5rem] sm:text-[1.9rem]',
    meta: 'text-[0.95rem] sm:text-[1.1rem]',
  },
} as const

interface AnilloProgresoProps {
  valor: number
  meta: number
  etiqueta: string
  /** Dónde debería ir a esta altura de la semana. Sin esto no hay marca. */
  marcaEsperado?: number
  /** Atrasado respecto del ritmo: el arco pasa a ámbar. */
  alerta?: boolean
  /** Lo que va debajo de la etiqueta: el desglose, el estado del ritmo. */
  detalle?: ReactNode
  /**
   * Va al lado de la etiqueta, típicamente un `TooltipAyuda`. Prop aparte y no
   * `etiqueta: ReactNode` porque la etiqueta también es el `aria-label` del
   * anillo y tiene que seguir siendo texto.
   */
  ayuda?: ReactNode
  /** `normal` es el de la semana de gestión; `grande`, el de la meta del mes. */
  tamano?: keyof typeof TAMANOS
  /**
   * En false la etiqueta no se muestra, pero sigue siendo el `aria-label` del
   * anillo. Para cuando la card ya dice qué mide el anillo en su título.
   */
  etiquetaVisible?: boolean
}

/**
 * Un anillo de progreso con el número adentro, para las metas de la semana.
 *
 * El arco se topea en la vuelta completa; el número muestra el valor real,
 * porque pasarse de la meta es un dato.
 *
 * Colores: meta cumplida en `primary-dark` —el mismo "cumplido" de la barra de
 * la etapa anterior—, atrasado en ámbar (`tibio`) y si no, el `primary` de
 * siempre.
 */
export function AnilloProgreso({
  valor,
  meta,
  etiqueta,
  marcaEsperado,
  alerta = false,
  detalle,
  ayuda,
  tamano = 'normal',
  etiquetaVisible = true,
}: AnilloProgresoProps) {
  const clases = TAMANOS[tamano]

  const metaSegura = Math.max(meta, 1)
  const progreso = Math.min(valor / metaSegura, 1)
  const cumplida = valor >= meta

  const colorArco = cumplida ? 'stroke-primary-dark' : alerta ? 'stroke-tibio' : 'stroke-primary'

  // La marca sólo dice algo entre el arranque y la vuelta completa: en 0 o en
  // la meta caería justo sobre el punto de inicio del arco.
  const fraccionMarca = marcaEsperado !== undefined ? marcaEsperado / metaSegura : null
  const marca =
    fraccionMarca !== null && fraccionMarca > 0 && fraccionMarca < 1
      ? puntosDeMarca(fraccionMarca)
      : null

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-label={etiqueta}
        className="relative grid shrink-0 place-items-center"
      >
        {/* -90° para que el arco arranque arriba, igual que en MetaMensual. */}
        <svg viewBox="0 0 160 160" aria-hidden className={`${clases.svg} -rotate-90`}>
          <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="none" strokeWidth="12" className="stroke-border" />
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={RADIO}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={CIRCUNFERENCIA * (1 - progreso)}
            className={`${colorArco} transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none`}
          />
          {/* La marca va en dos trazos: uno ancho del color de la card que la
              recorta del arco, y el fino encima. Sin el recorte se perdía
              contra el verde cuando el arco ya pasó por ahí. */}
          {marca && (
            <>
              <line {...marca} strokeWidth="7" strokeLinecap="round" className="stroke-surface" />
              <line {...marca} strokeWidth="3" strokeLinecap="round" className="stroke-ink-2" />
            </>
          )}
        </svg>

        <div className="absolute leading-none font-bold text-ink tabular-nums">
          <span className={clases.valor}>{valor}</span>
          <span className={`${clases.meta} font-semibold text-ink-3`}>/{meta}</span>
        </div>
      </div>

      {etiquetaVisible && (
        <div className="mt-2 inline-flex items-center justify-center gap-1 text-[0.75rem] leading-tight font-semibold text-ink-2 sm:text-[0.82rem]">
          <span>{etiqueta}</span>
          {ayuda}
        </div>
      )}
      {detalle && (
        <div className="mt-1 text-[0.7rem] leading-snug text-ink-3 sm:text-[0.75rem]">{detalle}</div>
      )}
    </div>
  )
}

/**
 * Los extremos de la marca, en coordenadas del SVG sin rotar.
 *
 * El trazo de un `<circle>` arranca a las 3 y avanza en sentido horario; con la
 * rotación de -90° del SVG, eso queda arrancando arriba. La marca usa el mismo
 * sistema, así cae exactamente donde va a pasar el arco.
 */
function puntosDeMarca(fraccion: number) {
  const angulo = fraccion * 2 * Math.PI
  const cos = Math.cos(angulo)
  const sin = Math.sin(angulo)
  const adentro = RADIO - LARGO_MARCA
  const afuera = RADIO + LARGO_MARCA
  return {
    x1: CENTRO + adentro * cos,
    y1: CENTRO + adentro * sin,
    x2: CENTRO + afuera * cos,
    y2: CENTRO + afuera * sin,
  }
}
