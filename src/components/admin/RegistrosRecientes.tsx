import { Link } from 'react-router-dom'
import { EmailLink } from '../comunes/AccionesContacto'
import { IconoChat } from '../leads/Iconos'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import {
  DIAS_REGISTROS_RECIENTES,
  ETIQUETA_ESTADO,
  esRegistroNuevo,
  type RegistrosRecientes as Registros,
} from '../../lib/api/admin'
import { formatearInternacional, linkWhatsAppInternacional } from '../../lib/telefono'
import { BADGE_ESTADO } from './estilosEstado'

function fechaYHora(iso: string): string {
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  return f.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Quién se registró en los últimos 7 días, para escribirle por WhatsApp.
 *
 * Una fila por cuenta, con los datos de quien la creó. El punto del título
 * avisa que hay alguien de menos de 48 horas sin tener que leer la tabla.
 */
export function RegistrosRecientes({
  registros,
  ahora,
}: {
  registros: Registros
  ahora: Date
}) {
  const { total, lista } = registros
  const hayNuevos = lista.some((c) => esRegistroNuevo(c, ahora))

  return (
    <section
      aria-labelledby="titulo-registros"
      className="rounded-2xl border border-border bg-surface shadow-sm"
    >
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <h2
          id="titulo-registros"
          className="m-0 flex items-center gap-2 text-[0.95rem] font-bold text-ink"
        >
          Registros recientes
          {hayNuevos && (
            <span
              role="img"
              aria-label="Hay registros de las últimas 48 horas"
              title="Hay registros de las últimas 48 horas"
              className="size-2 rounded-full bg-peligro"
            />
          )}
        </h2>
        <p className="mt-1 mb-0 text-[0.82rem] text-ink-3 tabular-nums">
          {total === 1
            ? `1 registro en los últimos ${DIAS_REGISTROS_RECIENTES} días`
            : `${total} registros en los últimos ${DIAS_REGISTROS_RECIENTES} días`}
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="m-0 border-t border-border px-4 py-6 text-center text-[0.85rem] text-ink-3 sm:px-5">
          Nadie se registró en los últimos {DIAS_REGISTROS_RECIENTES} días.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[0.84rem]">
            <thead>
              <tr className="border-y border-border bg-surface-2 text-[0.74rem] font-semibold text-ink-3 uppercase">
                <th scope="col" className="px-4 py-2.5 sm:pl-5">Fecha</th>
                <th scope="col" className="px-3 py-2.5">Nombre</th>
                <th scope="col" className="px-3 py-2.5">Inmobiliaria</th>
                <th scope="col" className="px-3 py-2.5">Email</th>
                <th scope="col" className="px-3 py-2.5">Teléfono</th>
                <th scope="col" className="px-3 py-2.5">Plan</th>
                <th scope="col" className="px-4 py-2.5 sm:pr-5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const nuevo = esRegistroNuevo(c, ahora)
                const telefono = c.dueno?.telefono ?? null
                const whatsapp = telefono ? linkWhatsAppInternacional(telefono) : ''
                return (
                  <tr key={c.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2 tabular-nums sm:pl-5">
                      {fechaYHora(c.creadaEl)}
                      {nuevo && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">
                          Nuevo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">
                      {c.dueno?.nombre ?? <span className="text-peligro-ink">Sin dueño</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/admin/inmobiliarias/${c.id}`}
                        className="text-ink-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {c.nombre}
                      </Link>
                    </td>
                    <td className="max-w-56 px-3 py-3 text-ink-3">
                      {c.dueno ? <EmailLink email={c.dueno.email} /> : '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {telefono && whatsapp ? (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Escribir por WhatsApp"
                          aria-label={`WhatsApp a ${c.dueno?.nombre ?? 'la cuenta'}`}
                          className="inline-flex items-center gap-1.5 text-ink-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                        >
                          <IconoChat className="size-4" />
                          {formatearInternacional(telefono)}
                        </a>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {c.plan ? DETALLE_PLAN[c.plan].nombre : <span className="text-ink-4">Sin plan</span>}
                    </td>
                    <td className="px-4 py-3 sm:pr-5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.74rem] font-semibold ${BADGE_ESTADO[c.estado]}`}
                      >
                        {ETIQUETA_ESTADO[c.estado]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
