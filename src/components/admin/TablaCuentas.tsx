import { Link, useNavigate } from 'react-router-dom'
import { EmailLink } from '../comunes/AccionesContacto'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import {
  diasDesde,
  ETIQUETA_ESTADO,
  estaPorVencer,
  proximoHito,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { formatearFecha } from '../../lib/formatoFecha'
import { BADGE_ESTADO } from './estilosEstado'

/**
 * Una fila por inmobiliaria. Viene ya ordenada: GRACIA arriba.
 *
 * La fila en GRACIA lleva fondo y borde izquierdo rojos, además del badge: el
 * color tiene que alcanzar para encontrarla sin leer la columna de estado.
 *
 * Sin WhatsApp: `profiles` no guarda teléfono, y el único teléfono de la base
 * es el de los leads, que están fuera del alcance de este panel.
 *
 * La fila entera lleva al detalle. El nombre es además un <Link> de verdad:
 * es lo que se alcanza con Tab y lo que anuncia un lector de pantalla, porque
 * un <tr> con onClick no es navegable por teclado. Un click sobre otro link
 * de la fila (el mail) no navega: hace lo suyo.
 */
export function TablaCuentas({ cuentas }: { cuentas: CuentaAdmin[] }) {
  const navigate = useNavigate()

  return (
    <section aria-labelledby="titulo-cuentas" className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <h2 id="titulo-cuentas" className="m-0 text-[0.95rem] font-bold text-ink">
          Inmobiliarias
        </h2>
        <span className="text-[0.82rem] text-ink-3 tabular-nums">{cuentas.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[0.84rem]">
          <thead>
            <tr className="border-y border-border bg-surface-2 text-[0.74rem] font-semibold text-ink-3 uppercase">
              <th scope="col" className="px-4 py-2.5 sm:pl-5">Inmobiliaria</th>
              <th scope="col" className="px-3 py-2.5">Plan</th>
              <th scope="col" className="px-3 py-2.5">Estado</th>
              <th scope="col" className="px-3 py-2.5 text-right">Alta</th>
              <th scope="col" className="px-3 py-2.5">Próxima fecha</th>
              <th scope="col" className="px-4 py-2.5 sm:pr-5">Dueño</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c) => {
              const gracia = c.estado === 'GRACIA'
              const hito = proximoHito(c)
              const trialPorVencer = c.estado === 'TRIAL' && estaPorVencer(c)
              const dias = diasDesde(c.creadaEl)

              return (
                <tr
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a')) return
                    navigate(`/admin/inmobiliarias/${c.id}`)
                  }}
                  className={`cursor-pointer border-b border-border transition-colors last:border-b-0 motion-reduce:transition-none ${
                    gracia
                      ? 'bg-peligro-soft/60 shadow-[inset_3px_0_0_var(--color-peligro)] hover:bg-peligro-soft'
                      : 'hover:bg-surface-2'
                  }`}
                >
                  <th scope="row" className="px-4 py-3 font-semibold text-ink sm:pl-5">
                    <Link
                      to={`/admin/inmobiliarias/${c.id}`}
                      className="hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {c.nombre}
                    </Link>
                    {c.cancelacionSolicitada && (
                      <span className="mt-0.5 block text-[0.72rem] font-semibold text-badge-tibio-ink">
                        Pidió cancelar
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-ink-2">
                    {c.plan ? DETALLE_PLAN[c.plan].nombre : <span className="text-ink-4">Sin plan</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.74rem] font-semibold ${BADGE_ESTADO[c.estado]}`}
                    >
                      {ETIQUETA_ESTADO[c.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-ink-2 tabular-nums" title={formatearFecha(c.creadaEl)}>
                    {dias === 1 ? '1 día' : `${dias} días`}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {hito ? (
                      <span className="flex flex-col">
                        <span
                          className={`tabular-nums ${trialPorVencer ? 'font-semibold text-badge-tibio-ink' : 'text-ink-2'}`}
                        >
                          {formatearFecha(hito.fecha)}
                        </span>
                        <span className="text-[0.72rem] text-ink-3">{hito.etiqueta}</span>
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="max-w-64 px-4 py-3 sm:pr-5">
                    {c.dueno ? (
                      <span className="flex min-w-0 flex-col text-ink-2">
                        <span className="truncate">{c.dueno.nombre}</span>
                        <span className="truncate text-[0.78rem] text-ink-3">
                          <EmailLink email={c.dueno.email} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-peligro-ink">Sin dueño</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
