import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmailLink } from '../comunes/AccionesContacto'
import { IconoChat } from '../leads/Iconos'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import {
  DIAS_REGISTROS_RECIENTES,
  esRegistroNuevo,
  estadoVisible,
  type CuentaAdmin,
  type RegistrosRecientes as Registros,
} from '../../lib/api/admin'
import { formatearInternacional, linkWhatsAppInternacional } from '../../lib/telefono'
import { BadgeEstado } from './BadgeEstado'

/** Filas que se ven antes de "Ver todos". */
const FILAS_VISIBLES = 5

const FORMATO_FECHA_Y_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function fechaYHora(iso: string): string {
  const f = new Date(iso)
  return Number.isNaN(f.getTime()) ? '—' : FORMATO_FECHA_Y_HORA.format(f)
}

function Nuevo() {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-meta font-bold text-primary">
      Nuevo
    </span>
  )
}

/** El teléfono como botón de WhatsApp, o un guion si no hay. */
function Whatsapp({ cuenta }: { cuenta: CuentaAdmin }) {
  const telefono = cuenta.dueno?.telefono ?? null
  const whatsapp = telefono ? linkWhatsAppInternacional(telefono) : ''

  if (!telefono || !whatsapp) return <span className="text-ink-3">—</span>

  return (
    <a
      href={whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      title="Escribir por WhatsApp"
      aria-label={`WhatsApp a ${cuenta.dueno?.nombre ?? 'la cuenta'}`}
      className="inline-flex items-center gap-1.5 text-ink-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      <IconoChat className="size-4" />
      {formatearInternacional(telefono)}
    </a>
  )
}

/**
 * Quién se registró en los últimos 7 días, para escribirle por WhatsApp.
 *
 * Una fila por cuenta, con los datos de quien la creó. El punto del título
 * avisa que hay alguien de menos de 48 horas sin tener que leer la tabla.
 * Muestra las 5 más nuevas; "Ver todos" despliega el resto en el mismo lugar.
 * En el celular son tarjetas: la tabla no entra sin scroll horizontal.
 */
export function RegistrosRecientes({
  registros,
  ahora,
}: {
  registros: Registros
  ahora: Date
}) {
  const { total, lista } = registros
  const [todos, setTodos] = useState(false)
  const hayNuevos = lista.some((c) => esRegistroNuevo(c, ahora))
  const visibles = todos ? lista : lista.slice(0, FILAS_VISIBLES)

  return (
    <section
      aria-labelledby="titulo-registros"
      className="rounded-2xl border border-border bg-surface shadow-sm"
    >
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <h2
          id="titulo-registros"
          className="m-0 flex items-center gap-2 text-titulo font-bold text-ink"
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
        <p className="mt-1 mb-0 text-cuerpo text-ink-3 tabular-nums">
          {total === 1
            ? `1 registro en los últimos ${DIAS_REGISTROS_RECIENTES} días`
            : `${total} registros en los últimos ${DIAS_REGISTROS_RECIENTES} días`}
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="m-0 border-t border-border px-4 py-6 text-center text-cuerpo text-ink-3 sm:px-5">
          Nadie se registró en los últimos {DIAS_REGISTROS_RECIENTES} días.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-cuerpo">
              <thead>
                <tr className="border-y border-border bg-surface-2 text-meta font-semibold text-ink-3 uppercase">
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
                {visibles.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2 tabular-nums sm:pl-5">
                      {fechaYHora(c.creadaEl)}
                      {esRegistroNuevo(c, ahora) && (
                        <span className="ml-2">
                          <Nuevo />
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
                      <Whatsapp cuenta={c} />
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {c.plan ? DETALLE_PLAN[c.plan].nombre : <span className="text-ink-3">Sin plan</span>}
                    </td>
                    <td className="px-4 py-3 sm:pr-5">
                      <BadgeEstado estado={estadoVisible(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 border-t border-border p-4 sm:px-5 md:hidden">
            {visibles.map((c) => (
              <li key={c.id} className="min-w-0 rounded-xl border border-border bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-cuerpo font-semibold break-words text-ink">
                    {c.dueno?.nombre ?? <span className="text-peligro-ink">Sin dueño</span>}
                  </span>
                  <BadgeEstado estado={estadoVisible(c)} />
                </div>

                <Link
                  to={`/admin/inmobiliarias/${c.id}`}
                  className="mt-0.5 block break-words text-cuerpo text-ink-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {c.nombre}
                </Link>

                <p className="mt-1.5 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
                  <span className="tabular-nums">{fechaYHora(c.creadaEl)}</span>
                  {esRegistroNuevo(c, ahora) && <Nuevo />}
                  <span>· {c.plan ? DETALLE_PLAN[c.plan].nombre : 'Sin plan'}</span>
                </p>

                <div className="mt-2 flex flex-col gap-1.5 text-cuerpo">
                  {c.dueno && (
                    <span className="min-w-0 truncate text-ink-3">
                      <EmailLink email={c.dueno.email} />
                    </span>
                  )}
                  <Whatsapp cuenta={c} />
                </div>
              </li>
            ))}
          </ul>

          {lista.length > FILAS_VISIBLES && (
            <div className="border-t border-border px-4 py-2 sm:px-5">
              <button
                type="button"
                onClick={() => setTodos((v) => !v)}
                aria-expanded={todos}
                className="w-full rounded-md px-2 py-2 text-cuerpo font-semibold text-primary transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              >
                {todos ? 'Ver menos' : `Ver todos (${lista.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
