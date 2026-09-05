import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import { avisoDeSuscripcion } from '../lib/api/suscripcion'

/**
 * Avisa que el trial se termina o que el último cobro falló.
 *
 * Sólo informa: los estados que cortan el acceso los ataja `SuscripcionGuard`
 * antes de que se llegue a montar el layout. Y sólo lo ve el DUENO, porque es
 * el único que puede hacer algo al respecto —un agente no contrata ni cambia el
 * medio de pago, así que para él sería una alarma sin salida—.
 *
 * El cierre no se persiste a propósito: vive en el estado de este componente y
 * el `key` con el que lo monta `AppLayout` lo reinicia en cada navegación. Es un
 * aviso de cobro, no una preferencia; que se pueda sacar de encima para leer la
 * pantalla no es lo mismo que poder silenciarlo.
 */
export function BannerSuscripcion() {
  const { profile } = useAuth()
  const estado = useEstadoSuscripcion()
  const [cerrado, setCerrado] = useState(false)

  if (profile?.rol !== 'DUENO' || cerrado) return null

  const aviso = avisoDeSuscripcion(estado.data)
  if (!aviso) return null

  const esGracia = aviso.tipo === 'gracia'

  const mensaje = esGracia
    ? 'Tu último pago no pudo procesarse. Actualizá tu medio de pago antes de que se te venza el acceso.'
    : `Te ${aviso.dias === 1 ? 'queda' : 'quedan'} ${aviso.dias} ${
        aviso.dias === 1 ? 'día' : 'días'
      } de prueba gratis.`

  return (
    <div
      role="status"
      className={`flex items-center gap-3 border-b px-4 py-2.5 sm:px-6 ${
        esGracia
          ? 'border-peligro-borde bg-peligro-soft text-peligro-ink'
          : 'border-tibio/40 bg-warm-soft text-badge-tibio-ink'
      }`}
    >
      <p className="m-0 min-w-0 text-[0.85rem]">
        {mensaje}{' '}
        <Link
          to="/suscripcion"
          className="font-semibold whitespace-nowrap underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {esGracia ? 'Resolver' : 'Elegir plan'} →
        </Link>
      </p>

      <button
        type="button"
        onClick={() => setCerrado(true)}
        aria-label="Cerrar el aviso"
        className="ml-auto -mr-1 shrink-0 rounded-md p-1.5 transition-colors hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-reduce:transition-none"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
