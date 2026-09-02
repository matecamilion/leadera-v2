import { useEffect, useState } from 'react'
import { ComboboxLead } from '../comunes/ComboboxLead'
import { ComboboxPropiedad } from '../comunes/ComboboxPropiedad'
import { useAuth } from '../../contexts/AuthContext'
import { useEquipo } from '../../hooks/useEquipo'
import { useCrearVisita } from '../../hooks/useVisitas'
import { useOperacionesPorPropiedad } from '../../hooks/useOperacion'
import { esDiaPasado, hoyComoClave } from '../../lib/calendario'
import {
  esAbierta,
  etiquetaEstadoOperacion,
  etiquetaTipoOperacion,
} from '../../lib/api/operaciones'

const etiquetaCampo = 'mb-1.5 block text-xs font-semibold text-ink-3 uppercase'
const campo =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]'

/**
 * ", de Ana Pérez" — de quién es la operación.
 *
 * Se muestra porque la operación puede ser de otro lead que el de la visita: la
 * venta es del propietario y quien visita es un comprador. Sin el nombre, el
 * usuario no tiene cómo notar que eligió la equivocada.
 */
function nombreDeLead(operacion: { lead: { nombre: string; apellido: string | null } | null }): string {
  if (!operacion.lead) return ''
  return ` · de ${operacion.lead.nombre} ${operacion.lead.apellido ?? ''}`.trimEnd()
}

interface ModalNuevaVisitaProps {
  /**
   * Propiedad ya definida por el contexto (se abre desde su ficha). Cuando
   * viene, el selector no se muestra: ahí no hay nada que elegir.
   */
  propiedadFija?: { id: string; direccion: string }
  /** Día preseleccionado. */
  fechaInicial: string
  onCerrar: () => void
  onCreada?: () => void
}

export function ModalNuevaVisita({
  propiedadFija,
  fechaInicial,
  onCerrar,
  onCreada,
}: ModalNuevaVisitaProps) {
  const { profile } = useAuth()
  const miId = profile?.id ?? ''
  const rol = profile?.rol

  const [propiedadId, setPropiedadId] = useState<string | null>(
    propiedadFija?.id ?? null,
  )
  const [leadId, setLeadId] = useState<string | null>(null)
  /**
   * Elección manual de operación, atada a la propiedad con la que se hizo.
   * Cambiar de propiedad la invalida y vuelve a mandar la inferencia, sin
   * necesidad de un efecto que la resetee.
   *
   * `opId: null` es "sin operación" elegido a mano, distinto de no haber
   * elegido nada todavía.
   */
  const [eleccion, setEleccion] = useState<{
    clave: string
    opId: string | null
  } | null>(null)
  const [fecha, setFecha] = useState(fechaInicial)
  const [hora, setHora] = useState('')
  const [asignadoA, setAsignadoA] = useState(miId)
  const [notas, setNotas] = useState('')

  // Un asistente no reparte visitas: la suya queda a su nombre. Para agente y
  // dueño, `listarEquipo` ya devuelve a quién le pueden asignar.
  const puedeAsignar = rol === 'AGENTE' || rol === 'DUENO'
  const equipo = useEquipo(puedeAsignar ? rol : undefined, puedeAsignar ? miId : undefined)

  // El dueño se ve a sí mismo en el listado del equipo; el agente no. Se arma
  // la lista con uno mismo primero y sin repetidos.
  const otros = (equipo.data ?? []).filter((m) => m.id !== miId && m.activo)
  const hayAQuienAsignar = puedeAsignar && otros.length > 0

  const crear = useCrearVisita()

  // --- Operación vinculada --------------------------------------------------
  // Se infiere sola en vez de pedirla: agendar una visita ya es tedioso, y en
  // la enorme mayoría de los casos hay una sola operación posible.
  //
  // Candidata = operación abierta de la MISMA PROPIEDAD. El lead no entra en el
  // criterio, y no es un olvido: una operación de VENTA es del propietario,
  // mientras que la visita la agenda un comprador interesado. Son leads
  // distintos a propósito, y exigir que coincidieran dejaba el caso más común
  // —mostrarle a un comprador una propiedad que está en venta— sin candidatas.
  const operaciones = useOperacionesPorPropiedad(propiedadId ?? undefined)
  const candidatas = propiedadId
    ? (operaciones.data ?? []).filter((o) => esAbierta(o.estado))
    : []

  // `listarOperacionesPorPropiedad` ordena abiertas primero y, dentro del
  // grupo, por `created_at` desc. Filtradas a sólo abiertas, la primera es la
  // más reciente: es la que se sugiere.
  const sugerida = candidatas[0] ?? null

  // Todo derivado en render, sin efecto de sincronización. La clave es sólo la
  // propiedad: cambiar el lead ya no altera las candidatas, así que tampoco
  // tiene por qué descartar lo que el usuario eligió a mano.
  const claveActual = propiedadId ?? ''
  const eleccionVigente = eleccion?.clave === claveActual ? eleccion.opId : undefined

  const operacionElegida =
    eleccionVigente === undefined
      ? sugerida
      : (candidatas.find((o) => o.id === eleccionVigente) ?? null)

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const hoy = hoyComoClave()
  const fechaPasada = !!fecha && esDiaPasado(fecha)

  const faltaAlgo = !propiedadId || !fecha || !asignadoA || fechaPasada

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (faltaAlgo) return
    // El botón ya se deshabilita mientras guarda, pero un Enter repetido llega
    // por el submit del form sin pasar por él y crearía la visita dos veces.
    if (crear.isPending) return

    crear.mutate(
      {
        propiedad_id: propiedadId,
        lead_id: leadId,
        operacion_id: operacionElegida?.id ?? null,
        fecha,
        hora: hora || null,
        notas: notas || null,
        asignado_a: asignadoA,
      },
      {
        onSuccess: () => {
          onCreada?.()
          onCerrar()
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <form
        onSubmit={enviar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-nueva-visita"
        className="my-auto w-full max-w-[460px] rounded-2xl bg-surface p-6 shadow-modal"
      >
        <h2 id="titulo-nueva-visita" className="m-0 text-[1.05rem] font-bold text-ink">
          Agendar visita
        </h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">
          {propiedadFija
            ? 'Queda agendada para esta propiedad.'
            : 'Elegí la propiedad y, si ya sabés quién va, el lead.'}
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <span className={etiquetaCampo}>Propiedad</span>
            {propiedadFija ? (
              <p className="m-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[0.9rem] font-medium text-ink">
                {propiedadFija.direccion}
              </p>
            ) : (
              <ComboboxPropiedad value={propiedadId} onChange={setPropiedadId} />
            )}
          </div>

          <div>
            <span className={etiquetaCampo}>
              Lead <span className="normal-case">(opcional)</span>
            </span>
            <ComboboxLead value={leadId} onChange={setLeadId} />
            <p className="mt-1.5 text-[0.75rem] text-ink-4">
              Si la dejás sin lead, al marcarla como realizada no se registra
              ninguna interacción.
            </p>
          </div>

          {/* Una sola candidata: se vincula sola. Se avisa igual, para que no
              sea un comportamiento invisible. */}
          {candidatas.length === 1 && operacionElegida && (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[0.78rem] text-ink-3">
              Se vinculará a la operación{' '}
              <b className="font-semibold text-ink-2">{operacionElegida.titulo}</b> (
              {etiquetaTipoOperacion(operacionElegida.tipo)} ·{' '}
              {etiquetaEstadoOperacion(operacionElegida.estado)}
              {nombreDeLead(operacionElegida)}).{' '}
              {leadId
                ? 'Al marcarla como realizada, la interacción va a aparecer en su timeline.'
                : 'Sin lead no se registra ninguna interacción, así que en su timeline no va a aparecer nada.'}
            </p>
          )}

          {/* Dos o más: no hay forma de adivinar, decide el usuario. Arranca en
              la más reciente. */}
          {candidatas.length > 1 && (
            <div>
              <label htmlFor="visita-operacion" className={etiquetaCampo}>
                Operación vinculada
              </label>
              <select
                id="visita-operacion"
                value={operacionElegida?.id ?? ''}
                onChange={(e) =>
                  setEleccion({ clave: claveActual, opId: e.target.value || null })
                }
                className={campo}
              >
                {candidatas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo} · {etiquetaTipoOperacion(o.tipo)} ·{' '}
                    {etiquetaEstadoOperacion(o.estado)}
                    {nombreDeLead(o)}
                  </option>
                ))}
                <option value="">Sin operación</option>
              </select>
              <p className="mt-1.5 text-[0.75rem] text-ink-4">
                Esta propiedad tiene {candidatas.length} operaciones abiertas.
                Elegimos la más reciente; cambiala si corresponde a otra.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="visita-fecha" className={etiquetaCampo}>
                Fecha
              </label>
              <input
                id="visita-fecha"
                type="date"
                value={fecha}
                min={hoy}
                onChange={(e) => setFecha(e.target.value)}
                aria-invalid={fechaPasada || undefined}
                aria-describedby={fechaPasada ? 'visita-fecha-error' : undefined}
                className={campo}
              />
              {fechaPasada && (
                <p id="visita-fecha-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                  No se puede agendar para un día que ya pasó.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="visita-hora" className={etiquetaCampo}>
                Hora <span className="normal-case">(opcional)</span>
              </label>
              <input
                id="visita-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={campo}
              />
            </div>
          </div>

          {hayAQuienAsignar && (
            <div>
              <label htmlFor="visita-asignado" className={etiquetaCampo}>
                Quién la hace
              </label>
              <select
                id="visita-asignado"
                value={asignadoA}
                onChange={(e) => setAsignadoA(e.target.value)}
                className={campo}
              >
                <option value={miId}>Yo</option>
                {otros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.apellido}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="visita-notas" className={etiquetaCampo}>
              Notas <span className="normal-case">(opcional)</span>
            </label>
            <textarea
              id="visita-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Portero, llaves, horario de acceso…"
              className={`${campo} resize-y`}
            />
          </div>
        </div>

        {crear.isError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2.5 text-[0.82rem] text-peligro-ink"
          >
            {crear.error.message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={faltaAlgo || crear.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {crear.isPending ? 'Agendando…' : 'Agendar visita'}
          </button>
        </div>
      </form>
    </div>
  )
}
