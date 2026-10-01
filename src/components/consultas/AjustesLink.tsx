import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNombreAgente } from '../../hooks/useLead'
import { useCambiarActivo, useGuardarPreguntas } from '../../hooks/useLinkConsulta'
import type { LinkConsulta, PreguntaOpcional } from '../../lib/api/linksConsulta'

/** Qué se puede apagar en cada link: `visita` solo existe en el de propiedad y `vender` solo en el general. */
const PREGUNTAS: Record<'general' | 'propiedad', { id: PreguntaOpcional; label: string }[]> = {
  general: [
    { id: 'vender', label: 'Preguntar si tiene una propiedad para vender' },
    { id: 'email', label: 'Pedir email (es opcional para quien consulta)' },
  ],
  propiedad: [
    { id: 'visita', label: 'Preguntar si quiere coordinar una visita' },
    { id: 'email', label: 'Pedir email (es opcional para quien consulta)' },
  ],
}

function Interruptor({
  activo,
  deshabilitado,
  etiqueta,
  onCambiar,
}: {
  activo: boolean
  deshabilitado: boolean
  etiqueta: string
  onCambiar: (activo: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => onCambiar(!activo)}
      className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-lg px-1 text-left text-[0.86rem] text-ink-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[40px]"
    >
      <span>{etiqueta}</span>
      <span
        aria-hidden
        className={[
          'relative h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none',
          activo ? 'bg-primary' : 'bg-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none',
            activo ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

/**
 * Preguntas opcionales y pausa de un link.
 *
 * Solo el agente dueño del link las puede cambiar (lo hace cumplir la RLS).
 * Un asistente ve el estado pero no lo toca.
 */
export function AjustesLink({
  link,
  tipo,
}: {
  link: LinkConsulta
  tipo: 'general' | 'propiedad'
}) {
  const { profile } = useAuth()
  const puedeEditar = profile?.id === link.agente_id
  const agente = useNombreAgente(puedeEditar ? null : link.agente_id)

  const propiedadId = link.propiedad_id ?? undefined
  const preguntas = useGuardarPreguntas(propiedadId)
  const activo = useCambiarActivo(propiedadId)
  const [confirmandoPausa, setConfirmandoPausa] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const off = (link.preguntas_off ?? []) as PreguntaOpcional[]
  const error = preguntas.error ?? activo.error

  function cambiarPregunta(id: PreguntaOpcional, preguntar: boolean) {
    const siguiente = preguntar ? off.filter((p) => p !== id) : [...off, id]
    setGuardado(false)
    preguntas.mutate(
      { id: link.id, preguntasOff: siguiente },
      { onSuccess: () => setGuardado(true) },
    )
  }

  function cambiarActivo(nuevo: boolean) {
    activo.mutate({ id: link.id, activo: nuevo }, { onSuccess: () => setConfirmandoPausa(false) })
  }

  // Al pedir confirmación, el foco va a [Pausar]: Enter confirma, Escape vuelve.
  const refPausar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmandoPausa) refPausar.current?.focus()
  }, [confirmandoPausa])

  return (
    <div className="space-y-3">
      <fieldset className="m-0 border-none p-0">
        <legend className="mb-1 flex w-full items-center justify-between text-[0.8rem] font-semibold text-ink">
          Preguntas opcionales
          <span aria-live="polite" className="text-[0.74rem] font-medium text-primary">
            {preguntas.isPending ? 'Guardando…' : guardado ? 'Guardado' : ''}
          </span>
        </legend>
        {PREGUNTAS[tipo].map((p) => (
          <Interruptor
            key={p.id}
            etiqueta={p.label}
            activo={!off.includes(p.id)}
            deshabilitado={!puedeEditar || preguntas.isPending}
            onCambiar={(v) => cambiarPregunta(p.id, v)}
          />
        ))}
      </fieldset>

      <div className="border-t border-border pt-3">
        {!link.activo ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="m-0 flex-1 text-[0.84rem] text-ink-2">
              <span className="font-semibold text-ink">Link pausado.</span> Quien lo abra ve que no
              está disponible y no te llega nada.
            </p>
            {puedeEditar && (
              <button
                type="button"
                onClick={() => cambiarActivo(true)}
                disabled={activo.isPending}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 text-[0.84rem] font-semibold text-primary-contrast hover:bg-primary-hover disabled:opacity-60"
              >
                {activo.isPending ? 'Reactivando…' : 'Reactivar'}
              </button>
            )}
          </div>
        ) : confirmandoPausa ? (
          <div
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirmandoPausa(false)
            }}
          >
            <p className="m-0 text-[0.84rem] text-ink-2">
              ¿Pausar este link? Quien lo abra va a ver que no está disponible y no te va a llegar
              nada hasta que lo reactives.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                ref={refPausar}
                onClick={() => cambiarActivo(false)}
                disabled={activo.isPending}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-ink px-4 text-[0.84rem] font-semibold text-white hover:bg-ink-2 disabled:opacity-60"
              >
                {activo.isPending ? 'Pausando…' : 'Pausar'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoPausa(false)}
                disabled={activo.isPending}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-border bg-surface px-4 text-[0.84rem] font-semibold text-ink-2 hover:bg-background"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          puedeEditar && (
            <button
              type="button"
              onClick={() => setConfirmandoPausa(true)}
              className="inline-flex min-h-[40px] items-center rounded-lg px-1 text-[0.84rem] font-semibold text-ink-3 hover:text-ink"
            >
              Pausar este link
            </button>
          )
        )}
      </div>

      {!puedeEditar && (
        <p className="m-0 text-[0.78rem] text-ink-3">
          Las preguntas y la pausa las maneja {agente.data ?? 'el agente al que asistís'}.
        </p>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-lg bg-peligro-soft px-3 py-2 text-[0.82rem] text-peligro-ink">
          {error.message}
        </p>
      )}
    </div>
  )
}
