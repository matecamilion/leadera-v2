import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAceptarConsulta, useDescartarConsulta, useVincularConsulta } from '../../hooks/useConsultas'
import type { Consulta, ResultadoAceptar } from '../../lib/api/consultas'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import { linkTelefono, linkWhatsApp } from '../../lib/telefono'
import { useUiStore } from '../../stores/ui'
import { EnlaceAPlanes } from '../comunes/EnlaceAPlanes'
import { ETIQUETA_TIPO } from '../consulta-publica/catalogo'
import type { TipoPropiedad } from '../consulta-publica/tipos'
import { ModalDescartar } from './ModalDescartar'
import { BadgeTemperatura, Chip, RespuestasConsulta } from './RespuestasConsulta'

/**
 * "hace 3 horas", "ayer", "el 01/10/2026": `tiempoTranscurrido` devuelve el
 * pedazo suelto ("3 horas") pensado para una columna; acá va dentro de una frase.
 */
function haceCuanto(fecha: string | null): string {
  const t = tiempoTranscurrido(fecha)
  if (t === 'Hace instantes') return 'hace instantes'
  if (t === 'Ayer') return 'ayer'
  if (/^\d+ (hora|horas|días)$/.test(t)) return `hace ${t}`
  return `el ${t}`
}

function nombreDe(p: { nombre: string; apellido: string | null } | null | undefined): string {
  return p ? `${p.nombre} ${p.apellido ?? ''}`.trim() : ''
}

const BOTON_PRIMARIO =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'
const BOTON_SECUNDARIO =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'
const BOTON_TEXTO =
  'inline-flex min-h-[40px] items-center rounded-lg px-2 py-2 text-[0.85rem] font-semibold text-ink-3 transition-colors hover:text-peligro-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

function Girando() {
  return (
    <span className="size-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current motion-reduce:animate-none" />
  )
}

/** Lo que dejó la última acción en esta tarjeta y no se puede leer de la fila. */
type Mensaje =
  | { tipo: 'email'; resultado: Extract<ResultadoAceptar, { tipo: 'email_duplicado' }> }
  | { tipo: 'error'; texto: string }

/**
 * Una consulta de la bandeja.
 *
 * Cada tarjeta tiene sus propias mutaciones: lo que carga es solo esta, y las
 * demás siguen usables mientras tanto.
 */
export function TarjetaConsulta({ consulta: c }: { consulta: Consulta }) {
  const { profile } = useAuth()
  const esDueno = profile?.rol === 'DUENO'
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  const aceptar = useAceptarConsulta()
  const descartar = useDescartarConsulta()
  const vincular = useVincularConsulta()
  const ocupada = aceptar.isPending || descartar.isPending || vincular.isPending

  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  // Estado local, sin migración: tocó WhatsApp y todavía no aceptó.
  const [escribio, setEscribio] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [errorDescarte, setErrorDescarte] = useState<string | null>(null)
  const [confirmandoVinculo, setConfirmandoVinculo] = useState(false)

  const pendiente = c.estado === 'PENDIENTE'
  const nombre = nombreDe(c)
  const nombreAgente = nombreDe(c.agente)
  const nombreExistente = nombreDe(c.lead_existente)
  const agenteExistente = nombreDe(c.lead_existente?.agente)

  const saludo = `Hola ${c.nombre.trim()}! Soy ${profile?.nombre ?? ''}, te escribo por la consulta que dejaste.`
  const whatsapp = linkWhatsApp(c.telefono, saludo)

  async function onAceptar() {
    setMensaje(null)
    try {
      const r = await aceptar.mutateAsync({ id: c.id, email: c.email })
      if (r.tipo === 'ok') mostrarAviso(`${nombre} ya está en Nuevos.`)
      else if (r.tipo === 'ya_resuelta') mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
      else if (r.tipo === 'sin_acceso') mostrarAviso('Ya no tenés acceso a esta consulta.', 'error')
      else if (r.tipo === 'email_duplicado') setMensaje({ tipo: 'email', resultado: r })
      // 'limite': la fila vuelve con `aviso_pendiente` y se muestra abajo.
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo aceptar.' })
    }
  }

  async function onDescartar(motivo: string | null) {
    setErrorDescarte(null)
    try {
      const r = await descartar.mutateAsync({ id: c.id, motivo })
      setDescartando(false)
      if (r.tipo === 'ok') mostrarAviso('Consulta descartada.')
      else mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
    } catch (e) {
      setErrorDescarte(e instanceof Error ? e.message : 'No se pudo descartar.')
    }
  }

  async function onVincular() {
    setMensaje(null)
    try {
      const r = await vincular.mutateAsync(c.id)
      setConfirmandoVinculo(false)
      if (r.tipo === 'ok') mostrarAviso(`Consulta vinculada al lead de ${agenteExistente || 'otro agente'}.`)
      else mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo vincular.' })
    }
  }

  const origen = c.propiedad
    ? `${ETIQUETA_TIPO[c.propiedad.tipo as TipoPropiedad] ?? c.propiedad.tipo}${c.propiedad.zona ? ` en ${c.propiedad.zona}` : ''}`
    : null

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      {/* --- Encabezado ------------------------------------------------------- */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[1rem] font-bold text-ink">{nombre}</h3>

          {/* Los datos de contacto van con la persona, no sueltos al costado.
              `gap` y no un "·" entre los dos: si el email baja de renglón, no
              arranca con un separador colgando. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.84rem]">
            <a
              href={linkTelefono(c.telefono)}
              aria-label={`Llamar a ${nombre}`}
              className="-my-1 inline-flex min-h-[32px] items-center font-semibold text-ink hover:text-primary hover:underline"
            >
              {c.telefono}
            </a>
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="-my-1 inline-flex min-h-[32px] min-w-0 items-center truncate text-ink-3 hover:text-primary hover:underline"
              >
                {c.email}
              </a>
            )}
          </div>

          <p className="mt-0.5 text-[0.78rem] text-ink-3">
            Llegó {haceCuanto(c.created_at)}
            {/* "link de": de quién es el link por el que entró, no quién la mandó. */}
            {esDueno && nombreAgente && <>&nbsp;· link de {nombreAgente}</>}
          </p>
        </div>
        <BadgeTemperatura temperatura={c.temperatura} puntaje={c.puntaje} />
      </header>

      <p className="mt-2 text-[0.82rem] text-ink-2">
        {c.propiedad ? (
          <>
            Consultó por{' '}
            <Link to={`/propiedades/${c.propiedad.id}`} className="font-semibold text-primary hover:underline">
              {origen}
            </Link>
            <span className="text-ink-3">&nbsp;· {c.propiedad.direccion}</span>
          </>
        ) : (
          <span className="text-ink-3">Link general</span>
        )}
      </p>

      {/* --- Chips ------------------------------------------------------------- */}
      {(c.volvio_a_consultar || c.posible_captacion || c.duplicado_otro_agente || c.estado === 'AUTO_ACEPTADA') && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {c.volvio_a_consultar && <Chip tono="volvio">Volvió a consultar</Chip>}
          {c.posible_captacion && (
            <Chip tono="captacion" titulo="Necesita vender para comprar o tiene una propiedad para vender">
              Posible captación
            </Chip>
          )}
          {c.duplicado_otro_agente && (
            <Chip tono="duplicado">Lead de {agenteExistente || 'otro agente'}</Chip>
          )}
          {c.estado === 'AUTO_ACEPTADA' && <Chip tono="neutro">Automática</Chip>}
        </div>
      )}

      {/* --- Respuestas -------------------------------------------------------- */}
      <div className="mt-3.5">
        <RespuestasConsulta respuestas={c.respuestas} />
      </div>

      {/* --- Avisos -------------------------------------------------------------- */}
      {pendiente && c.aviso_pendiente && (
        <div
          role="status"
          className="mt-3.5 rounded-lg border border-warning/25 bg-warm-soft px-3.5 py-2.5 text-[0.82rem] text-badge-tibio-ink"
        >
          <p className="m-0">{c.aviso_pendiente}</p>
          {esDueno ? (
            <EnlaceAPlanes />
          ) : (
            <p className="mt-1 mb-0">Pedile al dueño de la inmobiliaria que amplíe el plan.</p>
          )}
        </div>
      )}

      {mensaje?.tipo === 'email' && (
        <div role="alert" className="mt-3.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[0.82rem] text-ink-2">
          {mensaje.resultado.lead ? (
            <>
              Ya existe el lead{' '}
              <Link to={`/leads/${mensaje.resultado.lead.id}`} className="font-semibold text-primary hover:underline">
                {nombreDe(mensaje.resultado.lead)}
              </Link>{' '}
              con el email {mensaje.resultado.email}. Esta consulta queda pendiente para que la
              descartes.
            </>
          ) : (
            <>
              Ya hay un lead con el email {mensaje.resultado.email} en la inmobiliaria.{' '}
              <Link
                to={`/leads?q=${encodeURIComponent(mensaje.resultado.email)}`}
                className="font-semibold text-primary hover:underline"
              >
                Buscalo en Leads
              </Link>
              ; esta consulta queda pendiente para que la descartes.
            </>
          )}
        </div>
      )}

      {mensaje?.tipo === 'error' && (
        <p role="alert" className="mt-3.5 rounded-lg border border-peligro-borde bg-peligro-soft px-3.5 py-2.5 text-[0.82rem] text-peligro-ink">
          {mensaje.texto}
        </p>
      )}

      {/* --- Acciones ------------------------------------------------------------ */}
      {pendiente && c.duplicado_otro_agente ? (
        <div className="mt-4 border-t border-border pt-3.5">
          {confirmandoVinculo ? (
            <div className="text-[0.82rem] text-ink-2">
              <p className="m-0">
                Se va a vincular al lead{' '}
                {c.lead_existente ? (
                  <Link to={`/leads/${c.lead_existente.id}`} className="font-semibold text-primary hover:underline">
                    {nombreExistente}
                  </Link>
                ) : (
                  'existente'
                )}{' '}
                de {agenteExistente || 'otro agente'}. No se crea un lead nuevo.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={onVincular} disabled={ocupada} className={BOTON_PRIMARIO}>
                  {vincular.isPending && <Girando />}
                  Confirmar vínculo
                </button>
                <button type="button" onClick={() => setConfirmandoVinculo(false)} disabled={ocupada} className={BOTON_SECUNDARIO}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setConfirmandoVinculo(true)} disabled={ocupada} className={BOTON_PRIMARIO}>
                Vincular al lead de {agenteExistente.split(' ')[0] || 'otro agente'}
              </button>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}>
                  WhatsApp
                </a>
              )}
              <button type="button" onClick={() => setDescartando(true)} disabled={ocupada} className={`${BOTON_TEXTO} ml-auto`}>
                Descartar
              </button>
            </div>
          )}
        </div>
      ) : pendiente ? (
        <div className="mt-4 border-t border-border pt-3.5">
          {escribio && (
            <p role="status" className="mt-0 mb-3 rounded-lg bg-brand-softer px-3.5 py-2.5 text-[0.82rem] text-primary-dark">
              ¿Ya le escribiste? Pasala a Nuevos para registrar el contacto.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onAceptar} disabled={ocupada} className={BOTON_PRIMARIO}>
              {aceptar.isPending && <Girando />}
              {escribio ? 'Pasar a Nuevos' : 'Aceptar'}
            </button>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setEscribio(true)}
                className={BOTON_SECUNDARIO}
              >
                WhatsApp
              </a>
            )}
            <button type="button" onClick={() => setDescartando(true)} disabled={ocupada} className={`${BOTON_TEXTO} ml-auto`}>
              Descartar
            </button>
          </div>
        </div>
      ) : (
        <PieResuelta consulta={c} />
      )}

      <ModalDescartar
        abierto={descartando}
        nombre={c.nombre.trim()}
        descartando={descartar.isPending}
        error={errorDescarte}
        onCancelar={() => {
          setDescartando(false)
          setErrorDescarte(null)
        }}
        onConfirmar={onDescartar}
      />
    </article>
  )
}

/** Las resueltas no tienen acciones: dicen qué pasó y llevan al lead. */
function PieResuelta({ consulta: c }: { consulta: Consulta }) {
  const cuando = haceCuanto(c.resuelta_at)
  const texto =
    c.estado === 'AUTO_ACEPTADA'
      ? `Pasó sola a Nuevos ${cuando}`
      : c.estado === 'ACEPTADA'
        ? `Aceptada ${cuando}`
        : c.estado === 'VINCULADA'
          ? `Vinculada a un lead existente ${cuando}`
          : `Descartada ${cuando}${c.motivo_descarte ? ` · ${c.motivo_descarte}` : ''}`

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[0.8rem] text-ink-3">
      <span>{texto}</span>
      {c.lead_id && (
        <Link to={`/leads/${c.lead_id}`} className="font-semibold text-primary hover:underline">
          Ver lead →
        </Link>
      )}
    </div>
  )
}
