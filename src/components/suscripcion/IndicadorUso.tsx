import type { UsoDeRecurso } from '../../lib/api/uso'

/**
 * A partir de esta proporción el indicador avisa que queda poco.
 *
 * Es más alto que el 0.8 del cupo de usuarios de `IndicadorCupo`: sumar una
 * persona al equipo es una decisión que conviene ver venir con tiempo, mientras
 * que los leads y las propiedades se cargan de a muchos y avisar tan temprano
 * sería ruido durante la mayor parte del mes.
 */
const UMBRAL_ALERTA = 0.9

interface IndicadorUsoProps {
  etiqueta: string
  /** Cómo se nombra la unidad en plural. Para el caso sin tope: "8 leads". */
  unidad: string
  uso: UsoDeRecurso
}

/**
 * Un recurso del plan y cuánto queda.
 *
 * Replica el patrón de `IndicadorCupo` —mismos tres estados, mismos colores—
 * pero parametrizado: aquel está atado a `CupoEquipo` y a su copy de equipo
 * ("personas", "lugares"), que no se puede reutilizar para leads o propiedades.
 */
export function IndicadorUso({ etiqueta, unidad, uso }: IndicadorUsoProps) {
  const encabezado = <p className="m-0 text-[0.8rem] font-semibold text-ink">{etiqueta}</p>

  // Plan sin tope: no hay barra que dibujar porque no hay contra qué llenarla.
  if (uso.sinTope) {
    return (
      <div>
        {encabezado}
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-2">
          <span>
            <b className="text-ink tabular-nums">{uso.usados}</b> {unidad}
          </span>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">
            Sin límite
          </span>
        </p>
      </div>
    )
  }

  // Tope desconocido —sin plan asociado, o la fila de límites no se pudo leer—:
  // el conteo a secas. No se puede afirmar ni que sobra lugar ni que falta.
  if (uso.limite == null) {
    return (
      <div>
        {encabezado}
        <p className="mt-1.5 text-[0.8rem] text-ink-2">
          <b className="text-ink tabular-nums">{uso.usados}</b> {unidad}
        </p>
      </div>
    )
  }

  const limite = Math.max(uso.limite, 1)
  const proporcion = uso.usados / limite
  const lleno = uso.usados >= uso.limite
  const casiLleno = !lleno && proporcion >= UMBRAL_ALERTA
  const restantes = uso.limite - uso.usados

  const colorBarra = lleno ? 'bg-caliente' : casiLleno ? 'bg-tibio' : 'bg-primary'

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        {encabezado}
        {lleno && (
          <span className="rounded-full bg-hot-soft px-2 py-0.5 text-[0.68rem] font-bold text-caliente uppercase">
            Al tope
          </span>
        )}
      </div>

      <p className="mb-1.5 text-[0.8rem] text-ink-2">
        <b className="text-ink tabular-nums">{uso.usados}</b> de{' '}
        <b className="text-ink tabular-nums">{uso.limite}</b>
      </p>

      <div
        role="progressbar"
        aria-valuenow={uso.usados}
        aria-valuemin={0}
        aria-valuemax={uso.limite}
        aria-label={`${etiqueta}: ${uso.usados} de ${uso.limite}`}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${colorBarra}`}
          style={{ width: `${Math.min(proporcion * 100, 100)}%` }}
        />
      </div>

      {lleno ? (
        <p className="mt-1.5 text-[0.75rem] text-caliente">Llegaste al tope de tu plan.</p>
      ) : casiLleno ? (
        <p className="mt-1.5 text-[0.75rem] text-badge-tibio-ink">
          {restantes === 1 ? 'Te queda 1 lugar.' : `Te quedan ${restantes} lugares.`}
        </p>
      ) : null}
    </div>
  )
}
