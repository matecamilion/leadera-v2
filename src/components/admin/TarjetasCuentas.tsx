import { Link } from 'react-router-dom'
import {
  estadoVisible,
  ETIQUETA_METODO,
  ETIQUETA_TIPO_CUENTA,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import { BadgeEstado } from './BadgeEstado'
import { VenceEn } from './VenceEn'

/**
 * El listado como tarjetas, para el celular: la tabla no entra sin scroll
 * horizontal. Cada tarjeta entera es un link al detalle.
 *
 * Sin el email del dueño: un link de mail adentro de otro link no es HTML
 * válido, y el contacto está en la ficha.
 */
export function TarjetasCuentas({ cuentas, ahora }: { cuentas: CuentaAdmin[]; ahora: Date }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-4 sm:px-5">
      {cuentas.map((c) => (
        <li key={c.id}>
          <Link
            to={`/admin/inmobiliarias/${c.id}`}
            className={`block min-w-0 rounded-xl border p-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              c.estado === 'GRACIA'
                ? 'border-peligro-borde bg-peligro-soft/60 hover:bg-peligro-soft'
                : 'border-border bg-surface hover:border-ink-subtle'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-cuerpo font-semibold break-words text-ink">{c.nombre}</span>
              <BadgeEstado estado={estadoVisible(c)} />
            </span>

            <span className="mt-1 block text-meta text-ink-3">
              {c.plan ? DETALLE_PLAN[c.plan].nombre : 'Sin plan'} · {ETIQUETA_METODO[c.metodoCobro]}
              {c.tipoCuenta !== 'CLIENTE' && ` · ${ETIQUETA_TIPO_CUENTA[c.tipoCuenta]}`}
              {c.cancelacionSolicitada && ' · Pidió cancelar'}
            </span>

            <span className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
              Vence en
              <VenceEn cuenta={c} ahora={ahora} />
            </span>

            <span className="mt-1.5 block text-meta break-words text-ink-3">
              Dueño: {c.dueno ? c.dueno.nombre : <span className="text-peligro-ink">sin dueño</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
