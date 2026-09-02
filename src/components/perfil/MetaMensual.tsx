import { useState } from 'react'
import { useGuardarMeta } from '../../hooks/usePerfil'

const RADIO = 64
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

interface MetaMensualProps {
  ganadosMes: number
  meta: number
  diasRestantes: number
}

/**
 * Meta de cierres del mes, con el anillo de progreso del original.
 *
 * El input arranca vacío y sólo se usa mientras se está editando: si guardara
 * su valor en un estado sincronizado con la prop, un refetch mientras tipeás
 * te pisaría lo escrito.
 */
export function MetaMensual({ ganadosMes, meta, diasRestantes }: MetaMensualProps) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const guardar = useGuardarMeta()

  const progreso = Math.min((ganadosMes / Math.max(meta, 1)) * 100, 100)
  const faltan = Math.max(meta - ganadosMes, 0)
  // diasRestantesDelMes() cuenta hoy, así que nunca es 0 y no hay división por cero.
  const ritmo = faltan / Math.max(diasRestantes, 1)

  function abrirEdicion() {
    setBorrador(String(meta))
    setEditando(true)
    guardar.reset()
  }

  function cancelar() {
    setEditando(false)
    guardar.reset()
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const valor = Number(borrador)
    if (!Number.isFinite(valor) || valor < 1) return
    guardar.mutate(valor, { onSuccess: () => setEditando(false) })
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Meta del mes</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[0.72rem] font-semibold text-ink-3">
          {diasRestantes}d restantes
        </span>
      </header>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
        <div className="relative grid shrink-0 place-items-center">
          <svg viewBox="0 0 160 160" aria-hidden className="size-[150px] -rotate-90">
            <circle cx="80" cy="80" r={RADIO} fill="none" strokeWidth="12" className="stroke-border" />
            <circle
              cx="80"
              cy="80"
              r={RADIO}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - progreso / 100)}
              className="stroke-primary transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
            />
          </svg>

          <div className="absolute text-center">
            <div className="text-[1.6rem] leading-none font-bold text-ink tabular-nums">
              {ganadosMes}
              <span className="text-[1rem] font-semibold text-ink-3">/{meta}</span>
            </div>
            <div className="mt-0.5 text-[0.7rem] text-ink-3">cierres</div>
          </div>
        </div>

        <div className="w-full">
          <p className="text-[0.9rem] text-ink-2">
            {faltan === 0 ? (
              <>
                Ya llegaste a tu meta de <b className="text-ink">{meta}</b>. Todo lo que
                cierres de acá en adelante suma de más.
              </>
            ) : (
              <>
                Te {faltan === 1 ? 'falta' : 'faltan'} <b className="text-ink">{faltan}</b>{' '}
                para llegar a tu meta, necesitás{' '}
                <b className="text-ink tabular-nums">{ritmo.toFixed(1)}</b> por día.
              </>
            )}
          </p>

          {editando ? (
            <form onSubmit={enviar} className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="meta-mensual" className="text-[0.8rem] text-ink-3">
                Meta
              </label>
              <input
                id="meta-mensual"
                type="number"
                min={1}
                max={999}
                step={1}
                value={borrador}
                autoFocus
                onChange={(e) => setBorrador(e.target.value)}
                className="w-20 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.9rem] text-ink tabular-nums focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]"
              />
              <button
                type="submit"
                disabled={guardar.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-[0.82rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="rounded-lg border border-border px-3 py-1.5 text-[0.82rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={abrirEdicion}
              className="mt-3 text-[0.82rem] font-semibold text-primary hover:underline"
            >
              Cambiar meta
            </button>
          )}

          {guardar.isError && (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.8rem] text-peligro-ink"
            >
              {guardar.error.message}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
