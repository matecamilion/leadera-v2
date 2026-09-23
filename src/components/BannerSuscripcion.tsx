import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import { avisoDeSuscripcion, DETALLE_PLAN } from '../lib/api/suscripcion'
import { linkDeCobros, mensajeDeRenovacion } from '../lib/config'
import { formatearFecha } from '../lib/formatoFecha'

/**
 * Avisa que el trial se termina, que el último cobro falló o que hay que
 * renovar la transferencia.
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
 *
 * El aviso de una cuenta manual ya vencida no se puede cerrar: ahí el acceso se
 * corta en tres días y no hay reintento automático que lo salve, así que el
 * único camino es escribir y renovar.
 */
export function BannerSuscripcion() {
  const { profile } = useAuth()
  const estado = useEstadoSuscripcion()
  const [cerrado, setCerrado] = useState(false)

  if (profile?.rol !== 'DUENO') return null

  const aviso = avisoDeSuscripcion(estado.data)
  if (!aviso) return null

  const urgente = aviso.tipo === 'gracia' || aviso.tipo === 'manual_vencido'
  // El único que no se deja cerrar: sin renovación no hay acceso.
  const puedeCerrarse = aviso.tipo !== 'manual_vencido'
  if (cerrado && puedeCerrarse) return null

  const mensaje =
    aviso.tipo === 'gracia'
      ? 'Tu último pago no pudo procesarse. Actualizá tu medio de pago antes de que se te venza el acceso.'
      : aviso.tipo === 'manual_por_vencer'
        ? `Tu plan vence el ${formatearFecha(aviso.vence)}. Para renovarlo, escribinos y te pasamos los datos de transferencia.`
        : aviso.tipo === 'manual_vencido'
          ? `Tu plan venció el ${formatearFecha(aviso.vencio)}. Renovalo antes del ${formatearFecha(aviso.limite)} para no perder el acceso.`
          : `Te ${aviso.dias === 1 ? 'queda' : 'quedan'} ${aviso.dias} ${
              aviso.dias === 1 ? 'día' : 'días'
            } de prueba gratis.`

  const esManual = aviso.tipo === 'manual_por_vencer' || aviso.tipo === 'manual_vencido'
  const plan = estado.data?.plan
  const whatsapp = esManual
    ? linkDeCobros(
        mensajeDeRenovacion(estado.data?.nombre ?? null, plan ? DETALLE_PLAN[plan].nombre : null),
      )
    : null

  return (
    <div
      role={urgente ? 'alert' : 'status'}
      className={`flex items-center gap-3 border-b px-4 py-2.5 sm:px-6 ${
        urgente
          ? 'border-peligro-borde bg-peligro-soft text-peligro-ink'
          : 'border-tibio/40 bg-warm-soft text-badge-tibio-ink'
      }`}
    >
      <p className="m-0 min-w-0 text-[0.85rem]">
        {mensaje}{' '}
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold whitespace-nowrap underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Renovar por WhatsApp →
          </a>
        ) : (
          <Link
            to="/suscripcion"
            className="font-semibold whitespace-nowrap underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {esManual ? 'Ver mi plan' : urgente ? 'Resolver' : 'Elegir plan'} →
          </Link>
        )}
      </p>

      {puedeCerrarse && (
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
      )}
    </div>
  )
}
