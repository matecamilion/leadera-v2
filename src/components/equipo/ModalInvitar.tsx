import { useEffect, useRef, useState } from 'react'
import { useCrearInvitacion } from '../../hooks/useEquipo'
import { etiquetaRol, type Miembro, type RolAgente } from '../../lib/api/equipo'
import { formatearFecha } from '../../lib/formatoFecha'

/** Cuánto dura el "¡Copiado!" antes de volver al botón normal. */
const MS_FEEDBACK_COPIA = 2000

interface ModalInvitarProps {
  /** Rol de quien invita: decide qué puede ofrecer el formulario. */
  miRol: RolAgente
  miId: string
  /** Agentes a los que se puede asignar un asistente. Sólo lo usa el DUENO. */
  agentes: Miembro[]
  onCerrar: () => void
}

/**
 * Genera un link de invitación.
 *
 * Un DUENO elige el rol y, si invita a un ASISTENTE, a qué agente asiste. Un
 * AGENTE no elige nada: sólo puede sumar un asistente para sí mismo, así que
 * el rol y el `asiste_a` van fijos y el formulario se reduce a un botón.
 */
export function ModalInvitar({ miRol, miId, agentes, onCerrar }: ModalInvitarProps) {
  const esDueno = miRol === 'DUENO'

  const [rol, setRol] = useState<RolAgente>(esDueno ? 'AGENTE' : 'ASISTENTE')
  const [asisteA, setAsisteA] = useState<string>('')
  const [copiado, setCopiado] = useState(false)
  const invitar = useCrearInvitacion()
  const dialogo = useRef<HTMLDivElement | null>(null)

  // Cerrar con Escape, como los otros modales de la app.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const necesitaAsistido = esDueno && rol === 'ASISTENTE'
  const faltaElegirAgente = necesitaAsistido && !asisteA

  function generar() {
    setCopiado(false)
    invitar.mutate({
      rol,
      // Un AGENTE siempre invita para sí mismo: el selector ni aparece.
      asisteA: rol === 'ASISTENTE' ? (esDueno ? asisteA : miId) : null,
    })
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), MS_FEEDBACK_COPIA)
    } catch {
      // Sin permiso de portapapeles el usuario todavía puede seleccionar el
      // texto a mano, que sigue visible en pantalla.
      setCopiado(false)
    }
  }

  const invitacion = invitar.data

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-invitar"
        className="w-full max-w-[440px] rounded-2xl bg-surface p-6 shadow-modal"
      >
        <h2 id="titulo-invitar" className="m-0 text-[1.05rem] font-bold text-ink">
          Invitar a alguien
        </h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">
          {esDueno
            ? 'Se genera un link de un solo uso. Quien lo abra completa sus datos y entra con el rol que elijas.'
            : 'Se genera un link de un solo uso para sumar a tu asistente. Va a quedar asignado a vos.'}
        </p>

        {!invitacion ? (
          <>
            {esDueno ? (
              <>
                <div className="mt-5">
                  <label
                    htmlFor="rol-invitado"
                    className="mb-1.5 block text-xs font-semibold text-ink-3 uppercase"
                  >
                    Rol
                  </label>
                  <select
                    id="rol-invitado"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as RolAgente)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]"
                  >
                    <option value="AGENTE">Agente</option>
                    <option value="ASISTENTE">Asistente</option>
                  </select>
                </div>

                {necesitaAsistido && (
                  <div className="mt-4">
                    <label
                      htmlFor="asiste-a"
                      className="mb-1.5 block text-xs font-semibold text-ink-3 uppercase"
                    >
                      A quién asiste
                    </label>
                    <select
                      id="asiste-a"
                      value={asisteA}
                      onChange={(e) => setAsisteA(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]"
                    >
                      <option value="">Elegí un agente…</option>
                      {agentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} {a.apellido}
                        </option>
                      ))}
                    </select>
                    {agentes.length === 0 && (
                      <p className="mt-1.5 text-[0.78rem] text-ink-3">
                        Todavía no hay agentes a los que asignar un asistente.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem] text-ink-2">
                Rol: <b className="text-ink">Asistente</b> · asignado a vos
              </p>
            )}

            {invitar.isError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2.5 text-[0.82rem] text-peligro-ink"
              >
                {invitar.error.message}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={generar}
                disabled={invitar.isPending || faltaElegirAgente}
                className="rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
              >
                {invitar.isPending ? 'Generando…' : 'Generar link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-border bg-surface-2 p-3">
              <p className="mb-2 text-[0.78rem] text-ink-3">
                Link para {etiquetaRol(invitacion.rol).toLowerCase()} · vence el{' '}
                {formatearFecha(invitacion.expira_at)}
              </p>
              <p className="m-0 break-all font-mono text-[0.78rem] text-ink-2">
                {invitacion.link}
              </p>
            </div>

            <p className="mt-3 text-[0.78rem] text-ink-3">
              Pasáselo por donde prefieras. Sirve una sola vez.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
              >
                Listo
              </button>
              <button
                type="button"
                onClick={() => copiar(invitacion.link)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[0.85rem] font-semibold text-white',
                  'transition-colors motion-reduce:transition-none',
                  copiado ? 'bg-primary-dark' : 'bg-primary hover:bg-primary-dark',
                ].join(' ')}
              >
                {copiado ? (
                  <>
                    <IconoCheck className="size-4" />
                    ¡Copiado!
                  </>
                ) : (
                  'Copiar link'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function IconoCheck({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
