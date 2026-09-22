import { EmailLink } from '../comunes/AccionesContacto'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import { diasDesde, type CuentaAdmin } from '../../lib/api/admin'
import { formatearFecha } from '../../lib/formatoFecha'

/**
 * Las cuentas en GRACIA, aparte y arriba de todo: el cobro ya falló y el cron
 * diario las pasa a VENCIDA si no se resuelve. En la tabla general quedarían
 * como una fila más.
 *
 * El padre no la monta si no hay ninguna: una alerta vacía entrena a no
 * mirarla.
 */
export function AlertaGracia({ cuentas }: { cuentas: CuentaAdmin[] }) {
  return (
    <section
      aria-labelledby="titulo-gracia"
      className="rounded-2xl border border-peligro-borde bg-peligro-soft p-4 sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-peligro text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
        </span>
        <h2 id="titulo-gracia" className="m-0 text-[1.05rem] font-bold text-peligro-ink">
          {cuentas.length === 1
            ? '1 cuenta en período de gracia'
            : `${cuentas.length} cuentas en período de gracia`}
        </h2>
      </div>
      <p className="mt-1.5 mb-4 text-[0.85rem] text-ink-2">
        El último cobro falló. Si no se regulariza, el cron diario las pasa a Vencida y pierden el
        acceso.
      </p>

      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {cuentas.map((c) => (
          <li key={c.id} className="rounded-xl border border-peligro-borde bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <strong className="text-[0.95rem] text-ink">{c.nombre}</strong>
              <span className="text-[0.78rem] font-semibold text-ink-3">
                {c.plan ? DETALLE_PLAN[c.plan].nombre : 'Sin plan'}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.82rem]">
              <dt className="text-ink-3">Falló el cobro</dt>
              <dd className="m-0 font-semibold text-peligro-ink">
                {c.ultimoPagoFallido
                  ? `${formatearFecha(c.ultimoPagoFallido)} · hace ${diasDesde(c.ultimoPagoFallido)} días`
                  : 'Sin fecha registrada'}
              </dd>

              <dt className="text-ink-3">Último pago OK</dt>
              <dd className="m-0 text-ink-2">
                {c.ultimoPagoAprobado ? formatearFecha(c.ultimoPagoAprobado) : 'Ninguno en el último año'}
              </dd>

              <dt className="text-ink-3">Próximo cobro</dt>
              <dd className="m-0 text-ink-2">{formatearFecha(c.proximoCobro)}</dd>

              <dt className="text-ink-3">Dueño</dt>
              <dd className="m-0 min-w-0 text-ink-2">
                {c.dueno ? (
                  <span className="flex min-w-0 flex-col">
                    <span>{c.dueno.nombre}</span>
                    <EmailLink email={c.dueno.email} />
                  </span>
                ) : (
                  <span className="text-peligro-ink">Sin dueño asignado</span>
                )}
              </dd>
            </dl>

            {c.cancelacionSolicitada && (
              <p className="mt-3 mb-0 text-[0.78rem] font-semibold text-badge-tibio-ink">
                Pidió la cancelación.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
