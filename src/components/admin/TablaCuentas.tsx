import { Link, useNavigate } from 'react-router-dom'
import {
  ETIQUETA_METODO,
  estadoVisible,
  ETIQUETA_TIPO_CUENTA,
  fechaDeVencimiento,
  formatearFechaAR,
  haceCuantoAR,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import { BadgeEstado } from './BadgeEstado'
import { VenceEn } from './VenceEn'

/**
 * El listado como tabla, para pantallas medianas y grandes. Debajo de `md` se
 * usa `TarjetasCuentas`.
 *
 * La fila en GRACIA lleva fondo y borde izquierdo rojos, además del badge: el
 * color tiene que alcanzar para encontrarla sin leer la columna de estado.
 *
 * La fila entera lleva al detalle. El nombre es además un <Link> de verdad:
 * es lo que se alcanza con Tab y lo que anuncia un lector de pantalla, porque
 * un <tr> con onClick no es navegable por teclado.
 *
 * Todas las columnas van alineadas a la izquierda y con cifras de ancho fijo.
 *
 * Sin encabezado fijo: dentro de la página no tiene dónde fijarse, y meter la
 * tabla en un contenedor con scroll propio daría dos scrolls anidados.
 */
export function TablaCuentas({ cuentas, ahora }: { cuentas: CuentaAdmin[]; ahora: Date }) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-cuerpo">
        <thead>
          <tr className="border-y border-border bg-surface-2 text-meta font-semibold text-ink-3 uppercase">
            <th scope="col" className="px-4 py-2.5 sm:pl-5">Inmobiliaria</th>
            <th scope="col" className="px-3 py-2.5">Plan</th>
            <th scope="col" className="px-3 py-2.5">Estado</th>
            <th scope="col" className="px-3 py-2.5">Método</th>
            <th scope="col" className="px-3 py-2.5">Alta</th>
            <th scope="col" className="px-3 py-2.5">Vence</th>
            <th scope="col" className="px-4 py-2.5 sm:pr-5">Vence en</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => {
            const vence = fechaDeVencimiento(c)

            return (
              <tr
                key={c.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return
                  navigate(`/admin/inmobiliarias/${c.id}`)
                }}
                className={`cursor-pointer border-b border-border transition-colors last:border-b-0 motion-reduce:transition-none ${
                  c.estado === 'GRACIA'
                    ? 'bg-peligro-soft/60 shadow-[inset_3px_0_0_var(--color-peligro)] hover:bg-peligro-soft'
                    : 'hover:bg-surface-2'
                }`}
              >
                <th scope="row" className="min-w-0 px-4 py-3 align-top font-semibold text-ink sm:pl-5">
                  <Link
                    to={`/admin/inmobiliarias/${c.id}`}
                    className="break-words hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {c.nombre}
                  </Link>
                  {c.tipoCuenta !== 'CLIENTE' && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-meta font-bold text-ink-3 uppercase">
                      {ETIQUETA_TIPO_CUENTA[c.tipoCuenta]}
                    </span>
                  )}
                  <span className="mt-0.5 block text-meta font-normal break-words text-ink-3">
                    {c.dueno ? c.dueno.nombre : <span className="text-peligro-ink">Sin dueño</span>}
                  </span>
                  {c.cancelacionSolicitada && (
                    <span className="mt-0.5 block text-meta font-semibold text-badge-tibio-ink">
                      Pidió cancelar
                    </span>
                  )}
                </th>
                <td className="px-3 py-3 align-top text-ink-2">
                  {c.plan ? DETALLE_PLAN[c.plan].nombre : <span className="text-ink-3">Sin plan</span>}
                </td>
                <td className="px-3 py-3 align-top">
                  <BadgeEstado estado={estadoVisible(c)} />
                </td>
                <td className="px-3 py-3 align-top text-ink-2">{ETIQUETA_METODO[c.metodoCobro]}</td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <span className="block text-ink-2 tabular-nums">{formatearFechaAR(c.creadaEl)}</span>
                  <span className="block text-meta text-ink-3">{haceCuantoAR(c.creadaEl, ahora)}</span>
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap text-ink-2 tabular-nums">
                  {vence ? formatearFechaAR(vence) : <span className="text-ink-3">—</span>}
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap sm:pr-5">
                  <VenceEn cuenta={c} ahora={ahora} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
