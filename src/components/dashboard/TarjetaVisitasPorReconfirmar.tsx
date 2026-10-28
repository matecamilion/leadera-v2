import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
import { TONOS } from '../comunes/tonos'
import { IconoCalendario, IconoChat } from '../leads/Iconos'
import { useReconfirmarVisita, useVisitasPorReconfirmar } from '../../hooks/useVisitas'
import {
  construirMensajeReconfirmacion,
  contactoDeVisita,
  type VisitaPorReconfirmar,
} from '../../lib/api/visitas'
import { hoyEnArgentina } from '../../lib/ritmoSemanal'
import { linkWhatsApp } from '../../lib/telefono'
import { urlInvalida } from '../../lib/validaciones'

const CLASES_BOTON =
  'inline-flex min-h-10 items-center justify-center rounded-lg px-3.5 py-2 text-[0.8rem] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 motion-reduce:transition-none'

/**
 * Las visitas de mañana (y las de hoy que quedaron sin avisar) que el agente
 * todavía tiene que reconfirmar con el cliente.
 *
 * No existe mientras no haya nada que reconfirmar: ni cargando ni si la query
 * falla. Es un aviso, y un esqueleto que después desaparece sería ruido en la
 * pantalla de las cuentas que no tienen visitas.
 *
 * Abrir WhatsApp y marcar la reconfirmación son dos botones: abrir el chat no
 * prueba que el mensaje se envió.
 */
export function TarjetaVisitasPorReconfirmar({ className = '' }: { className?: string }) {
  const { data } = useVisitasPorReconfirmar()
  const reconfirmar = useReconfirmarVisita()
  const hoy = hoyEnArgentina()

  if (!data || data.length === 0) return null

  return (
    <SeccionCard
      icono={<IconoCalendario className="size-4" />}
      tono="tibio"
      titulo="Visitas por reconfirmar"
      subtitulo="Mandale al cliente los datos de la visita el día antes"
      badge={`${data.length} ${data.length === 1 ? 'visita' : 'visitas'}`}
      className={className}
    >
      <ul className="divide-y divide-border">
        {data.map((visita) => (
          <FilaVisita
            key={visita.id}
            visita={visita}
            hoy={hoy}
            reconfirmando={reconfirmar.isPending && reconfirmar.variables === visita.id}
            error={
              reconfirmar.isError && reconfirmar.variables === visita.id
                ? reconfirmar.error.message
                : null
            }
            onReconfirmar={() => reconfirmar.mutate(visita.id)}
          />
        ))}
      </ul>
    </SeccionCard>
  )
}

function FilaVisita({
  visita,
  hoy,
  reconfirmando,
  error,
  onReconfirmar,
}: {
  visita: VisitaPorReconfirmar
  hoy: string
  reconfirmando: boolean
  error: string | null
  onReconfirmar: () => void
}) {
  const esHoy = visita.fecha === hoy
  const direccion = visita.propiedad?.direccion ?? visita.titulo_externo ?? 'Propiedad'
  const link =
    !visita.propiedad_id && visita.link_externo && !urlInvalida(visita.link_externo)
      ? visita.link_externo
      : null
  const contacto = contactoDeVisita(visita.lead)
  const nombreCliente = visita.lead
    ? `${visita.lead.nombre} ${visita.lead.apellido ?? ''}`.trim()
    : null

  const whatsapp =
    contacto === 'CON_WHATSAPP' && visita.lead?.telefono
      ? linkWhatsApp(
          visita.lead.telefono,
          construirMensajeReconfirmacion({
            nombre: visita.lead.nombre,
            fecha: visita.fecha,
            hora: visita.hora,
            hoy,
            direccion,
            link,
          }),
        )
      : ''

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${esHoy ? TONOS.caliente : TONOS.neutro}`}
        >
          {esHoy ? 'Hoy' : 'Mañana'}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] font-semibold text-ink">
            {visita.hora && (
              <span className="mr-1.5 tabular-nums">{visita.hora.slice(0, 5)}</span>
            )}
            {direccion}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {nombreCliente ?? 'Sin cliente cargado'}
          </span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp con ${nombreCliente}`}
            className={`${CLASES_BOTON} gap-1.5 bg-brand-soft text-primary hover:bg-primary hover:text-primary-contrast`}
          >
            <IconoChat className="size-4" />
            WhatsApp
          </a>
        )}

        <button
          type="button"
          onClick={onReconfirmar}
          disabled={reconfirmando}
          className={`${CLASES_BOTON} border border-border text-ink hover:bg-surface-2`}
        >
          {reconfirmando ? 'Guardando…' : 'Ya lo reconfirmé'}
        </button>

        {contacto === 'SIN_TELEFONO' && visita.lead && (
          <span className="text-[0.78rem] text-ink-3">
            Sin teléfono válido.{' '}
            <Link
              to={`/leads/${visita.lead.id}`}
              className="font-semibold text-primary hover:underline"
            >
              Completarlo en la ficha
            </Link>
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-[0.78rem] text-peligro-ink">
          {error}
        </p>
      )}
    </li>
  )
}
