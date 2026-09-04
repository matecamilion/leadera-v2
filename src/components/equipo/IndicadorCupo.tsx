import type { CupoEquipo } from '../../lib/api/equipo'

/** A partir de esta proporción el indicador avisa que queda poco lugar. */
const UMBRAL_ALERTA = 0.8

export function IndicadorCupo({ cupo }: { cupo: CupoEquipo }) {
  const personas = cupo.usados === 1 ? 'persona en el equipo' : 'personas en el equipo'

  // Plan sin tope: no hay barra que dibujar porque no hay contra qué llenarla.
  // Se dice explícitamente, que es información útil, y no se insinúa ninguna
  // escasez.
  if (cupo.sinTope) {
    return (
      <p className="flex items-center gap-2 text-[0.8rem] text-ink-2">
        <span>
          <b className="text-ink tabular-nums">{cupo.usados}</b> {personas}
        </span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">
          Sin límite
        </span>
      </p>
    )
  }

  // Límite desconocido (la fila no se pudo leer): el conteo a secas. Acá no se
  // puede afirmar ni que sobra lugar ni que falta. El tope real lo aplica el
  // server al invitar.
  if (cupo.limite == null) {
    return (
      <p className="text-[0.8rem] text-ink-2">
        <b className="text-ink tabular-nums">{cupo.usados}</b> {personas}
      </p>
    )
  }

  const limite = Math.max(cupo.limite, 1)
  const proporcion = cupo.usados / limite
  const lleno = cupo.usados >= cupo.limite
  const casiLleno = !lleno && proporcion >= UMBRAL_ALERTA
  const restantes = cupo.limite - cupo.usados

  const colorBarra = lleno ? 'bg-caliente' : casiLleno ? 'bg-tibio' : 'bg-primary'

  return (
    <div className="w-full max-w-[260px]">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[0.8rem] text-ink-2">
          <b className="text-ink tabular-nums">{cupo.usados}</b> de{' '}
          <b className="text-ink tabular-nums">{cupo.limite}</b> lugares usados
        </span>
        {lleno && (
          <span className="rounded-full bg-hot-soft px-2 py-0.5 text-[0.68rem] font-bold text-caliente uppercase">
            Sin cupo
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={cupo.usados}
        aria-valuemin={0}
        aria-valuemax={cupo.limite}
        aria-label="Lugares del plan usados"
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${colorBarra}`}
          style={{ width: `${Math.min(proporcion * 100, 100)}%` }}
        />
      </div>

      {lleno ? (
        <p className="mt-1.5 text-[0.75rem] text-caliente">
          Para sumar a alguien más necesitás ampliar el plan.
        </p>
      ) : casiLleno ? (
        <p className="mt-1.5 text-[0.75rem] text-badge-tibio-ink">
          Te {restantes === 1 ? 'queda 1 lugar' : `quedan ${restantes} lugares`}.
        </p>
      ) : null}
    </div>
  )
}
