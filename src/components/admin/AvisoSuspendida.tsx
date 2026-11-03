import { AVISO_CUENTA_SUSPENDIDA } from './textosAdmin'

/** El aviso de los modales que no reactivan una cuenta suspendida. */
export function AvisoSuspendida() {
  return (
    <p
      role="note"
      className="mb-4 rounded-xl border border-peligro-borde bg-peligro-soft px-4 py-3 text-cuerpo font-semibold text-peligro-ink"
    >
      {AVISO_CUENTA_SUSPENDIDA}
    </p>
  )
}
