import type { SVGProps } from 'react'
import { useTema } from '../hooks/useTema'

interface BotonTemaProps {
  /** Props comunes de los íconos del layout (tamaño, trazo, currentColor). */
  trazo: SVGProps<SVGSVGElement>
}

/**
 * Alterna entre modo claro y oscuro. Muestra lo que se va a activar: la luna
 * en claro, el sol en oscuro.
 *
 * Mismo borde, color y alto que "Cerrar sesión", al lado del cual va: el
 * padding de 7px más el ícono de 18px dan los 34px de ese botón.
 */
export function BotonTema({ trazo }: BotonTemaProps) {
  const { tema, alternarTema } = useTema()
  const oscuro = tema === 'oscuro'
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={etiqueta}
      title={etiqueta}
      className="rounded-md border border-border p-[7px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink motion-reduce:transition-none"
    >
      {oscuro ? (
        <svg {...trazo}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg {...trazo}>
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </button>
  )
}
