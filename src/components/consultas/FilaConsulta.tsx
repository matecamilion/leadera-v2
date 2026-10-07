import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAceptarConsulta, useDescartarConsulta, useVincularConsulta } from '../../hooks/useConsultas'
import type { Consulta, ResultadoAceptar } from '../../lib/api/consultas'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import { linkTelefono, linkWhatsApp } from '../../lib/telefono'
import { useUiStore } from '../../stores/ui'
import { EnlaceAPlanes } from '../comunes/EnlaceAPlanes'
import { IconoChat, IconoCerrar } from '../leads/Iconos'
import { BloquePuntaje, ChipEspera, RespuestasConsulta, Senal } from './RespuestasConsulta'
import { resumenCorto } from './respuestas'
import { minutosDesde } from './urgencia'

function nombreDe(p: { nombre: string; apellido: string | null } | null | undefined): string {
  return p ? `${p.nombre} ${p.apellido ?? ''}`.trim() : ''
}

/** "hace 3 horas", "ayer", "el 01/10/2026", dentro de una frase. */
function haceCuanto(fecha: string | null): string {
  const t = tiempoTranscurrido(fecha)
  if (t === 'Hace instantes') return 'hace instantes'
  if (t === 'Ayer') return 'ayer'
  if (/^\d+ (hora|horas|días)$/.test(t)) return `hace ${t}`
  return `el ${t}`
}

const MOTIVOS = ['Solo curiosidad', 'Fuera de presupuesto', 'Datos inválidos', 'Otro'] as const
type Motivo = (typeof MOTIVOS)[number]

const BTN_PRIMARIO =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[0.86rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:min-h-[38px]'
const BTN_SECUNDARIO =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[0.86rem] font-semibold text-ink-2 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:min-h-[38px]'
const BTN_ICONO =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-ink-3 transition-colors hover:border-ink-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'
const BTN_TEXTO =
  'inline-flex min-h-[38px] items-center rounded-lg px-2 text-[0.84rem] font-semibold text-ink-3 transition-colors hover:text-peligro-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

function Girando() {
  return (
    <span className="size-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current motion-reduce:animate-none" />
  )
}

type Mensaje =
  | { tipo: 'email'; resultado: Extract<ResultadoAceptar, { tipo: 'email_duplicado' }> }
  | { tipo: 'error'; texto: string }

/** Qué ocupa el lugar de las acciones. */
type Modo = 'acciones' | 'descartar' | 'vincular'

/**
 * Una consulta en la bandeja: una fila para decidir de reojo.
 *
 * Puntaje a la izquierda (la señal dominante), resumen en una línea, espera y
 * señales al alcance, acciones siempre a mano. El detalle se despliega.
 *
 * Cada fila tiene sus propias mutaciones: lo que carga es solo ésta. Al
 * resolverse, la fila se pliega (220 ms) antes de que el refetch la saque.
 */
export function FilaConsulta({
  consulta: c,
  ahora,
  conEspera = true,
}: {
  consulta: Consulta
  ahora: number
  /** Sin el chip de espera: en Archivadas todas pasan los 30 días y sería ruido. */
  conEspera?: boolean
}) {
  const { profile } = useAuth()
  const esDueno = profile?.rol === 'DUENO'
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  const aceptar = useAceptarConsulta()
  const descartar = useDescartarConsulta()
  const vincular = useVincularConsulta()
  const ocupada = aceptar.isPending || descartar.isPending || vincular.isPending

  const [modo, setModo] = useState<Modo>('acciones')
  const [motivo, setMotivo] = useState<Motivo | null>(null)
  const [otro, setOtro] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [escribio, setEscribio] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)

  const idDetalle = useId()
  const refConfirmar = useRef<HTMLButtonElement>(null)

  // Al pasar a confirmar, el foco va al botón que confirma: Enter descarta,
  // Escape vuelve.
  useEffect(() => {
    if (modo !== 'acciones') refConfirmar.current?.focus()
  }, [modo])

  const pendiente = c.estado === 'PENDIENTE'
  const verEspera = pendiente && conEspera
  const nombre = nombreDe(c)
  const nombreAgente = nombreDe(c.agente)
  const agenteExistente = nombreDe(c.lead_existente?.agente)
  const resumen = resumenCorto(c.respuestas, c.propiedad)
  const minutos = minutosDesde(c.created_at, ahora)

  const saludo = `Hola ${c.nombre.trim()}! Soy ${profile?.nombre ?? ''}, te escribo por la consulta que dejaste.`
  const whatsapp = linkWhatsApp(c.telefono, saludo)

  async function onAceptar() {
    setMensaje(null)
    try {
      const r = await aceptar.mutateAsync({ id: c.id, email: c.email })
      if (r.tipo === 'ok') {
        setSaliendo(true)
        mostrarAviso(`${nombre} ya está en Nuevos.`)
      } else if (r.tipo === 'ya_resuelta') mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
      else if (r.tipo === 'sin_acceso') mostrarAviso('Ya no tenés acceso a esta consulta.', 'error')
      else if (r.tipo === 'email_duplicado') setMensaje({ tipo: 'email', resultado: r })
      // 'limite': la fila vuelve con `aviso_pendiente` y se muestra abajo.
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo aceptar.' })
    }
  }

  async function onDescartar() {
    setMensaje(null)
    const texto = motivo === 'Otro' ? otro.trim().slice(0, 300) || 'Otro' : motivo
    try {
      const r = await descartar.mutateAsync({ id: c.id, motivo: texto })
      if (r.tipo === 'ok') {
        setSaliendo(true)
        mostrarAviso('Consulta descartada.')
      } else {
        setModo('acciones')
        mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo descartar.' })
    }
  }

  async function onVincular() {
    setMensaje(null)
    try {
      const r = await vincular.mutateAsync(c.id)
      if (r.tipo === 'ok') {
        setSaliendo(true)
        mostrarAviso(`Consulta vinculada al lead de ${agenteExistente || 'otro agente'}.`)
      } else {
        setModo('acciones')
        mostrarAviso('Alguien ya resolvió esta consulta.', 'error')
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo vincular.' })
    }
  }

  function cancelarModo() {
    setModo('acciones')
    setMotivo(null)
    setOtro('')
  }

  const hayAviso = pendiente && Boolean(c.aviso_pendiente)

  return (
    // Se pliega con grid-template-rows (1fr → 0fr): anima el alto real sin
    // medirlo. Con reduced-motion desaparece sin transición.
    <li
      className={[
        'grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        saliendo ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
      ].join(' ')}
      aria-hidden={saliendo || undefined}
    >
      <article aria-label={nombre} className="min-h-0 overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr] gap-x-3 px-3.5 py-3.5 sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:gap-x-4 sm:px-4">
          <BloquePuntaje temperatura={c.temperatura} puntaje={c.puntaje} />

          {/* --- Contenido ------------------------------------------------- */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="m-0 min-w-0 truncate text-[0.95rem] font-semibold text-ink">{nombre}</h3>
              {verEspera && (
                <span className="ml-auto sm:hidden">
                  <ChipEspera minutos={minutos} />
                </span>
              )}
            </div>

            <p className="m-0 mt-0.5 truncate text-[0.84rem] text-ink-2" title={resumen}>
              {resumen || 'Sin respuestas'}
            </p>

            <p className="m-0 mt-1 text-[0.76rem] leading-relaxed text-ink-3">
              <a href={linkTelefono(c.telefono)} className="font-medium text-ink-2 hover:text-primary hover:underline">
                {c.telefono}
              </a>
              {c.propiedad && (
                <>
                  &nbsp;·{' '}
                  <Link to={`/propiedades/${c.propiedad.id}`} className="hover:text-primary hover:underline">
                    {c.propiedad.direccion}
                  </Link>
                </>
              )}
              {!c.propiedad && <>&nbsp;· Link general</>}
              {esDueno && nombreAgente && <>&nbsp;· link de {nombreAgente}</>}
            </p>

            {(c.volvio_a_consultar || c.posible_captacion || c.duplicado_otro_agente || hayAviso || c.estado === 'AUTO_ACEPTADA') && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {hayAviso && (
                  <Senal tipo="limite" titulo="El plan llegó a su límite de leads">
                    Límite del plan
                  </Senal>
                )}
                {c.duplicado_otro_agente && (
                  <Senal tipo="duplicado" titulo="Ya es lead de otro agente: lo resuelve el dueño">
                    De {agenteExistente.split(' ')[0] || 'otro agente'}
                  </Senal>
                )}
                {c.volvio_a_consultar && (
                  <Senal tipo="volvio" titulo="Ya era lead y volvió a consultar">
                    Volvió
                  </Senal>
                )}
                {c.posible_captacion && (
                  <Senal tipo="captacion" titulo="Necesita vender para comprar o tiene una propiedad para vender">
                    Captación
                  </Senal>
                )}
                {c.estado === 'AUTO_ACEPTADA' && (
                  <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[0.72rem] font-semibold text-ink-3">
                    Automática
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              aria-expanded={abierta}
              aria-controls={idDetalle}
              onClick={() => setAbierta((a) => !a)}
              className="-ml-1 mt-1 inline-flex min-h-[32px] items-center gap-1 rounded-md px-1 text-[0.78rem] font-semibold text-primary hover:underline"
            >
              {abierta ? 'Ocultar respuestas' : 'Ver respuestas'}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className={`transition-transform duration-200 motion-reduce:transition-none ${abierta ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* --- Acciones en desktop ------------------------------------------ */}
          <div className="hidden flex-col items-end gap-2 sm:flex">
            {verEspera && <ChipEspera minutos={minutos} />}
            {pendiente && modo === 'acciones' && (
              <div className="flex items-center gap-1.5">
                {c.duplicado_otro_agente ? (
                  <button type="button" onClick={() => setModo('vincular')} disabled={ocupada} className={BTN_PRIMARIO}>
                    Vincular
                  </button>
                ) : (
                  <button type="button" onClick={onAceptar} disabled={ocupada} className={BTN_PRIMARIO}>
                    {aceptar.isPending && <Girando />}
                    {escribio ? 'Pasar a Nuevos' : 'Aceptar'}
                  </button>
                )}
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setEscribio(true)}
                    className={BTN_SECUNDARIO}
                  >
                    <IconoChat className="size-4" />
                    WhatsApp
                  </a>
                )}
                <button type="button" onClick={() => setModo('descartar')} disabled={ocupada} className={BTN_TEXTO}>
                  Descartar
                </button>
              </div>
            )}
          </div>

          {/* --- Lo que va a lo ancho: detalle, avisos, confirmaciones -------- */}
          <div className="col-span-2 sm:col-span-3 sm:col-start-2">
            <div
              id={idDetalle}
              hidden={!abierta}
              className="mt-2.5 rounded-lg bg-surface-2 px-3.5 py-3"
            >
              <RespuestasConsulta respuestas={c.respuestas} />
              {c.email && (
                <p className="m-0 mt-2 text-[0.8rem] text-ink-3">
                  Email:{' '}
                  <a href={`mailto:${c.email}`} className="font-medium text-ink-2 hover:text-primary hover:underline">
                    {c.email}
                  </a>
                </p>
              )}
            </div>

            {hayAviso && (
              <div role="status" className="mt-2.5 rounded-lg bg-warm-soft px-3.5 py-2.5 text-[0.82rem] text-badge-tibio-ink">
                <p className="m-0">{c.aviso_pendiente}</p>
                {esDueno ? (
                  <EnlaceAPlanes />
                ) : (
                  <p className="mt-1 mb-0">Pedile al dueño de la inmobiliaria que amplíe el plan.</p>
                )}
              </div>
            )}

            {mensaje?.tipo === 'email' && (
              <div role="alert" className="mt-2.5 rounded-lg bg-surface-2 px-3.5 py-2.5 text-[0.82rem] text-ink-2">
                {mensaje.resultado.lead ? (
                  <>
                    Ya existe el lead{' '}
                    <Link to={`/leads/${mensaje.resultado.lead.id}`} className="font-semibold text-primary hover:underline">
                      {nombreDe(mensaje.resultado.lead)}
                    </Link>{' '}
                    con el email {mensaje.resultado.email}. Esta consulta queda pendiente para que la descartes.
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
              <p role="alert" className="mt-2.5 mb-0 rounded-lg bg-peligro-soft px-3.5 py-2.5 text-[0.82rem] text-peligro-ink">
                {mensaje.texto}
              </p>
            )}

            {pendiente && escribio && modo === 'acciones' && (
              <p role="status" className="mt-2.5 mb-0 rounded-lg bg-brand-softer px-3.5 py-2.5 text-[0.82rem] text-primary-dark">
                ¿Ya le escribiste? Pasala a Nuevos para registrar el contacto.
              </p>
            )}

            {/* Confirmación de descarte, en la fila y sin modal. */}
            {pendiente && modo === 'descartar' && (
              <div
                className="mt-2.5 rounded-lg border border-border px-3.5 py-3"
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !descartar.isPending) cancelarModo()
                }}
              >
                <p className="m-0 text-[0.86rem] font-semibold text-ink">
                  ¿Descartar a {c.nombre.trim()}? No se puede deshacer.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Motivo (opcional)">
                  {MOTIVOS.map((m) => {
                    const activo = motivo === m
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setMotivo(activo ? null : m)}
                        className={[
                          'min-h-[34px] rounded-full border px-3 text-[0.78rem] font-medium transition-colors motion-reduce:transition-none',
                          activo
                            ? 'border-primary bg-brand-soft text-primary-dark'
                            : 'border-border bg-surface text-ink-2 hover:border-ink-subtle',
                        ].join(' ')}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
                {motivo === 'Otro' && (
                  <input
                    value={otro}
                    onChange={(e) => setOtro(e.target.value)}
                    maxLength={300}
                    aria-label="Contanos el motivo"
                    placeholder="Contanos el motivo"
                    className="mt-2 block w-full rounded-md border border-border px-3 py-2 text-[0.86rem] text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
                  />
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    ref={refConfirmar}
                    type="button"
                    onClick={onDescartar}
                    disabled={descartar.isPending}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-ink px-4 text-[0.86rem] font-semibold text-surface transition-colors hover:bg-ink-2 disabled:opacity-60 motion-reduce:transition-none"
                  >
                    {descartar.isPending && <Girando />}
                    Descartar
                  </button>
                  <button type="button" onClick={cancelarModo} disabled={descartar.isPending} className={BTN_SECUNDARIO}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Vínculo con el lead de otro agente (solo el dueño llega acá). */}
            {pendiente && modo === 'vincular' && (
              <div
                className="mt-2.5 rounded-lg border border-border px-3.5 py-3 text-[0.84rem] text-ink-2"
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !vincular.isPending) cancelarModo()
                }}
              >
                <p className="m-0">
                  Se vincula al lead{' '}
                  {c.lead_existente ? (
                    <Link to={`/leads/${c.lead_existente.id}`} className="font-semibold text-primary hover:underline">
                      {nombreDe(c.lead_existente)}
                    </Link>
                  ) : (
                    'existente'
                  )}{' '}
                  de {agenteExistente || 'otro agente'}. No se crea un lead nuevo.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button ref={refConfirmar} type="button" onClick={onVincular} disabled={ocupada} className={BTN_PRIMARIO}>
                    {vincular.isPending && <Girando />}
                    Confirmar vínculo
                  </button>
                  <button type="button" onClick={cancelarModo} disabled={ocupada} className={BTN_SECUNDARIO}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Acciones en mobile: abajo, en la zona del pulgar. */}
            {pendiente && modo === 'acciones' && (
              <div className="mt-2.5 flex items-center gap-2 sm:hidden">
                {c.duplicado_otro_agente ? (
                  <button type="button" onClick={() => setModo('vincular')} disabled={ocupada} className={`${BTN_PRIMARIO} flex-1`}>
                    Vincular al lead de {agenteExistente.split(' ')[0] || 'otro agente'}
                  </button>
                ) : (
                  <button type="button" onClick={onAceptar} disabled={ocupada} className={`${BTN_PRIMARIO} flex-1`}>
                    {aceptar.isPending && <Girando />}
                    {escribio ? 'Pasar a Nuevos' : 'Aceptar'}
                  </button>
                )}
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setEscribio(true)}
                    aria-label={`WhatsApp a ${nombre}`}
                    className={`${BTN_ICONO} hover:border-primary/50 hover:text-primary`}
                  >
                    <IconoChat className="size-5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setModo('descartar')}
                  disabled={ocupada}
                  aria-label={`Descartar la consulta de ${nombre}`}
                  className={BTN_ICONO}
                >
                  <IconoCerrar className="size-5" />
                </button>
              </div>
            )}

            {!pendiente && <PieResuelta consulta={c} />}
          </div>
        </div>
      </article>
    </li>
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
    <p className="m-0 mt-2 text-[0.78rem] text-ink-3">
      {texto}
      {c.lead_id && (
        <>
          {' '}
          <Link to={`/leads/${c.lead_id}`} className="font-semibold whitespace-nowrap text-primary hover:underline">
            Ver lead →
          </Link>
        </>
      )}
    </p>
  )
}
