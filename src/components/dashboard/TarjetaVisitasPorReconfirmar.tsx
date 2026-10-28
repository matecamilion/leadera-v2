import { useId, useState } from 'react'
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

/** Cuántas filas se ven sin expandir. */
const VISIBLES = 3

const CLASES_BOTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 py-2 text-[0.8rem] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 md:min-h-10 motion-reduce:transition-none'

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
  const [expandida, setExpandida] = useState(false)
  const hoy = hoyEnArgentina()

  if (!data || data.length === 0) return null

  const restantes = data.length - VISIBLES
  const visibles = expandida ? data : data.slice(0, VISIBLES)

  return (
    <SeccionCard
      icono={<IconoCalendario className="size-4" />}
      tono="tibio"
      titulo="Visitas por reconfirmar"
      subtitulo="Confirmá con tu cliente la dirección, el día y la hora"
      badge={`${data.length} ${data.length === 1 ? 'visita' : 'visitas'}`}
      className={className}
    >
      <ul className="divide-y divide-border">
        {visibles.map((visita) => (
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

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          aria-expanded={expandida}
          className="mt-1 min-h-10 w-full rounded-lg text-[0.8rem] font-semibold text-primary transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {expandida ? 'Ver menos' : `Ver ${restantes === 1 ? 'la restante' : `las ${restantes} restantes`}`}
        </button>
      )}
    </SeccionCard>
  )
}

/**
 * Tres zonas en escritorio —cuándo, qué y acciones— para que todas las filas
 * queden alineadas aunque falten la hora o el cliente. Debajo de `md` se apilan:
 * cuándo, qué, y los botones en una fila de dos mitades.
 */
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
  const [mensajeAbierto, setMensajeAbierto] = useState(false)
  const idMensaje = useId()
  const esHoy = visita.fecha === hoy
  const direccion = visita.propiedad?.direccion ?? visita.titulo_externo ?? 'Propiedad'
  const link =
    !visita.propiedad_id && visita.link_externo && !urlInvalida(visita.link_externo)
      ? visita.link_externo
      : null
  const zona = visita.propiedad?.zona
  const contacto = contactoDeVisita(visita.lead)
  const nombreCliente = visita.lead
    ? `${visita.lead.nombre} ${visita.lead.apellido ?? ''}`.trim()
    : null

  // El mismo texto va al botón de WhatsApp y al recuadro de "Ver mensaje": no
  // pueden diferir.
  const mensaje =
    contacto === 'CON_WHATSAPP' && visita.lead
      ? construirMensajeReconfirmacion({
          nombre: visita.lead.nombre,
          fecha: visita.fecha,
          hora: visita.hora,
          hoy,
          direccion,
          link,
        })
      : null
  const whatsapp = mensaje && visita.lead?.telefono ? linkWhatsApp(visita.lead.telefono, mensaje) : ''

  return (
    <li className="grid gap-x-4 gap-y-2 py-3 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${esHoy ? TONOS.caliente : TONOS.neutro}`}
        >
          {esHoy ? 'Hoy' : 'Mañana'}
        </span>
        {visita.hora ? (
          <span className="text-[0.9rem] font-semibold text-ink tabular-nums">
            {visita.hora.slice(0, 5)}
          </span>
        ) : (
          <span className="text-[0.82rem] text-ink-3">Sin hora</span>
        )}
      </div>

      <div className="min-w-0">
        <span className="block truncate text-[0.9rem] font-semibold text-ink">
          {direccion}
          {zona && <span className="font-normal text-ink-3"> · {zona}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
          {nombreCliente ?? 'Sin cliente cargado'}
        </span>
        {mensaje && (
          <button
            type="button"
            onClick={() => setMensajeAbierto((v) => !v)}
            aria-expanded={mensajeAbierto}
            aria-controls={idMensaje}
            className="mt-1 rounded text-[0.78rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {mensajeAbierto ? 'Ocultar' : 'Ver mensaje'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
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

        {contacto === 'SIN_TELEFONO' && visita.lead && (
          <Link
            to={`/leads/${visita.lead.id}`}
            className={`${CLASES_BOTON} bg-surface-2 text-ink hover:bg-border`}
          >
            Agregar teléfono
          </Link>
        )}

        <button
          type="button"
          onClick={onReconfirmar}
          disabled={reconfirmando}
          className={`${CLASES_BOTON} border border-border text-ink hover:bg-surface-2 ${contacto === 'SIN_CLIENTE' ? 'col-span-2 md:col-auto' : ''}`}
        >
          {reconfirmando ? 'Guardando…' : 'Ya lo reconfirmé'}
        </button>
      </div>

      {mensaje && mensajeAbierto && (
        <p
          id={idMensaje}
          className="rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem] break-words whitespace-pre-line text-ink-2 md:col-span-3"
        >
          {mensaje}
        </p>
      )}

      {error && (
        <p role="alert" className="text-[0.78rem] text-peligro-ink md:col-span-3">
          {error}
        </p>
      )}
    </li>
  )
}
