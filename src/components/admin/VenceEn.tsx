import {
  alertaDeCobro,
  diasHastaVencimiento,
  diasVencida,
  esSuspendida,
  ETIQUETA_ALERTA,
  textoDiasHasta,
  textoVencidaHace,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { BADGE_ALERTA } from './estilosEstado'

/**
 * Cuánto falta para que la cuenta pierda el acceso, o qué pasó ya.
 *
 * Lo que requiere atención va en una etiqueta de color: "Vencida hace N días",
 * "En gracia" o, si vence en los próximos 7 días, los días que faltan. El resto
 * es texto llano. Un "0 días" es "Hoy".
 */
export function VenceEn({ cuenta, ahora }: { cuenta: CuentaAdmin; ahora: Date }) {
  const alerta = alertaDeCobro(cuenta, ahora)
  const dias = diasHastaVencimiento(cuenta, ahora)

  // Una suspendida no "venció hace N días": la suspendieron. La fecha de su
  // último acceso pago no es lo que importa.
  if (esSuspendida(cuenta)) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold ${BADGE_ALERTA.vencida}`}
      >
        Suspendida
      </span>
    )
  }

  if (alerta === null) {
    return dias === null ? (
      <span className="text-ink-3">—</span>
    ) : (
      <span className="text-ink-2 tabular-nums">{textoDiasHasta(dias)}</span>
    )
  }

  const vencidaHace = alerta === 'vencida' ? diasVencida(cuenta, ahora) : null
  const texto =
    alerta === 'por_vencer'
      ? dias === null
        ? ETIQUETA_ALERTA.por_vencer
        : textoDiasHasta(dias)
      : vencidaHace === null
        ? ETIQUETA_ALERTA[alerta]
        : `Vencida ${textoVencidaHace(vencidaHace)}`

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold tabular-nums ${BADGE_ALERTA[alerta]}`}
    >
      {texto}
    </span>
  )
}
