import { useState } from 'react'
import { AnilloProgreso } from '../dashboard/AnilloProgreso'
import { useGuardarMeta } from '../../hooks/usePerfil'

interface MetaMensualProps {
  ganadosMes: number
  meta: number
  diasRestantes: number
}

/**
 * Ganados del mes contra la meta. Es la card protagonista de Estadísticas: el
 * KPI "Ganados del mes" se fue porque repetía este mismo número.
 *
 * El anillo es el `AnilloProgreso` de la semana de gestión, así las metas de la
 * app se leen igual en todos lados (incluido el verde oscuro al cumplirla).
 *
 * El input arranca vacío y sólo se usa mientras se está editando: si guardara
 * su valor en un estado sincronizado con la prop, un refetch mientras tipeás
 * te pisaría lo escrito.
 */
export function MetaMensual({ ganadosMes, meta, diasRestantes }: MetaMensualProps) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const guardar = useGuardarMeta()

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

  // El resumen dice sólo lo que falta; los números van en los tres bloques de
  // abajo, así la línea no repite lo que se lee al lado.
  const cifras = [
    { label: 'Ganados', valor: String(ganadosMes) },
    { label: 'Meta', valor: String(meta) },
    // Cumplida la meta no hay ritmo que sostener: un "0.0" leería como alerta.
    { label: 'Por día', valor: faltan === 0 ? '—' : ritmo.toFixed(1) },
  ]

  return (
    // `h-full` + cuerpo `flex-1`: la card se estira a la altura del donut de al
    // lado y el contenido se centra en ese alto, sin dejar una franja vacía
    // abajo. Fondo de marca suave: es la card protagonista de la pantalla.
    <section className="flex h-full flex-col rounded-2xl border border-border bg-brand-softer p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Ganados del mes</h2>
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[0.72rem] font-semibold text-ink-3">
          {diasRestantes}d restantes
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:gap-6">
        {/* `shrink-0`: el anillo trae `min-w-0` para vivir en la grilla de la
            semana, y acá, en fila con el texto `w-full`, se aplastaría. La
            etiqueta no se muestra —el título de la card ya dice qué mide— pero
            sigue siendo el nombre accesible del anillo. */}
        <div className="shrink-0">
          <AnilloProgreso
            valor={ganadosMes}
            meta={meta}
            etiqueta="Cierres del mes"
            etiquetaVisible={false}
            tamano="grande"
          />
        </div>

        <div className="w-full min-w-0">
          <p className="m-0 text-[0.9rem] text-ink-2">
            {faltan === 0 ? (
              <>Ya llegaste a tu meta. Todo lo que cierres suma de más.</>
            ) : (
              <>
                Te {faltan === 1 ? 'falta' : 'faltan'} <b className="text-ink">{faltan}</b>{' '}
                para llegar a tu meta.
              </>
            )}
          </p>

          <dl className="mt-3 grid grid-cols-3 gap-2">
            {cifras.map((c) => (
              <div key={c.label} className="min-w-0 rounded-xl bg-surface px-3 py-2">
                <dt className="truncate text-[0.72rem] font-semibold text-ink-3">{c.label}</dt>
                <dd className="m-0 mt-0.5 text-[1.2rem] leading-tight font-bold text-ink tabular-nums">
                  {c.valor}
                </dd>
              </div>
            ))}
          </dl>

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
                className="rounded-lg bg-primary px-3 py-1.5 text-[0.82rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
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
