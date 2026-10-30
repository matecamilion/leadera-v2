import { useId, useState, type ReactNode } from 'react'
import { avisosDeContraste } from './imagen/color'
import { normalizarHex, type EleccionColor } from './imagen/eleccionColor'
import { PALETAS } from './imagen/paletas'
import type { ClavePaleta, PaletaImagen } from './imagen/tipos'

interface Props {
  eleccion: EleccionColor
  /** La paleta que resulta de `eleccion`: de ella sale el nombre y el aviso. */
  paleta: PaletaImagen
  onAtajo: (clave: ClavePaleta) => void
  onColor: (cual: 'primario' | 'secundario', hex: string) => void
  /** Va arriba de los colores: los estilos guardados. */
  children?: ReactNode
}

/** El estilo del flyer: ocho atajos y dos colores libres, con aviso si se leen mal. */
export function SeccionEstilo({ eleccion, paleta, onAtajo, onColor, children }: Props) {
  const avisos = avisosDeContraste(paleta)
  const personalizada = eleccion.clave === 'personalizada'

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[0.8rem] font-semibold text-ink-2">Estilo</legend>

      {children}

      <div className="grid w-fit grid-cols-4 gap-3">
        {PALETAS.map((p) => {
          const elegida = eleccion.clave === p.clave
          return (
            <button
              key={p.clave}
              type="button"
              onClick={() => onAtajo(p.clave)}
              aria-pressed={elegida}
              aria-label={p.nombre}
              className={`relative size-9 rounded-full border border-ink-4 p-0 ${
                elegida ? 'ring-[3px] ring-primary ring-offset-2' : ''
              }`}
              style={{ background: `linear-gradient(135deg, ${p.fondo} 50%, ${p.acento} 50%)` }}
            >
              {elegida && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-contrast"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="m-0 mt-2 text-[0.8rem] text-ink-3">
        Paleta: {personalizada ? 'Personalizada' : paleta.nombre}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CampoColor
          label="Color principal"
          ayuda="Bloques, líneas y precio"
          valor={eleccion.primario}
          onCambiar={(hex) => onColor('primario', hex)}
        />
        <CampoColor
          label="Color de fondo"
          ayuda="Fondo de la pieza"
          valor={eleccion.secundario}
          onCambiar={(hex) => onColor('secundario', hex)}
        />
      </div>

      {/* Avisa, no bloquea: la descarga sigue disponible. */}
      {avisos.length > 0 && (
        <ul
          role="status"
          className="m-0 mt-3 flex list-none flex-col gap-1.5 rounded-lg bg-peligro-soft px-3.5 py-2.5 text-[0.82rem] text-peligro-ink"
        >
          {avisos.map((a) => (
            <li key={a.par}>{a.mensaje}</li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

/**
 * Selector nativo más campo de texto. Mientras se escribe un hex incompleto, el
 * texto es un borrador: recién cuando es válido sube al estado; al salir del
 * campo vuelve a mostrar el color vigente.
 */
function CampoColor({
  label,
  ayuda,
  valor,
  onCambiar,
}: {
  label: string
  ayuda: string
  valor: string
  onCambiar: (hex: string) => void
}) {
  const id = useId()
  const [borrador, setBorrador] = useState<string | null>(null)
  const invalido = borrador !== null && normalizarHex(borrador) === null

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-hex`} className="text-[0.8rem] font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          aria-label={`${label}, selector de color`}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-0.5"
        />
        <input
          id={`${id}-hex`}
          value={borrador ?? valor}
          maxLength={7}
          spellCheck={false}
          aria-invalid={invalido}
          aria-describedby={`${id}-ayuda`}
          onChange={(e) => {
            setBorrador(e.target.value)
            const hex = normalizarHex(e.target.value)
            if (hex) onCambiar(hex)
          }}
          onBlur={() => setBorrador(null)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[0.9rem] text-ink focus:border-primary focus:outline-none"
        />
      </div>
      <p id={`${id}-ayuda`} className={`m-0 text-xs ${invalido ? 'text-peligro-ink' : 'text-ink-3'}`}>
        {invalido ? 'Usá el formato #rrggbb' : ayuda}
      </p>
    </div>
  )
}
