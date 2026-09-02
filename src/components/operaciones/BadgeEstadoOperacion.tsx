import { etiquetaEstadoOperacion, type EstadoOperacion } from '../../lib/api/operaciones'

/**
 * Colores de `.badge-estado-operacion` del Angular.
 *
 * RESERVADA y EN_NEGOCIACION comparten el ámbar en el original; lo mantengo
 * para no alterar la paleta, aunque en un listado filtrable se distinguen
 * sólo por el texto.
 *
 * El `Record<EstadoOperacion, string>` obliga a cubrir el enum entero: si se
 * agrega un estado a la base, esto no compila hasta darle color.
 */
const ESTILOS: Record<EstadoOperacion, string> = {
  PUBLICADA: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  EN_NEGOCIACION: 'bg-badge-tibio-bg text-badge-tibio-ink',
  CERRADA_GANADA: 'bg-badge-ganado-bg text-primary-dark',
  CANCELADA: 'bg-badge-caliente-bg text-caliente',
}

export function BadgeEstadoOperacion({ estado }: { estado: EstadoOperacion }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold tracking-[0.03em] uppercase ${ESTILOS[estado]}`}
    >
      {etiquetaEstadoOperacion(estado)}
    </span>
  )
}
