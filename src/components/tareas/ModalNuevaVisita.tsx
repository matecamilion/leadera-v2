import { BotonCerrarModal } from '../comunes/BotonCerrarModal'
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
import { MAX_LINK_EXTERNO, MAX_TITULO_EXTERNO } from '../../lib/api/visitas'
import { MENSAJE_URL_INVALIDA, urlInvalida } from '../../lib/validaciones'

/**
 * Propia = a una propiedad cargada en LeadEra. Externa = a una que no está
 * cargada (de otra inmobiliaria, de un portal), identificada con texto libre.
 */
type Modo = 'propia' | 'externa'

const MODOS: { valor: Modo; label: string }[] = [
  { valor: 'propia', label: 'Propia' },
  { valor: 'externa', label: 'Externa' },
]

/** Qué está mal en el link, o null si está vacío o bien. */
function errorDeLink(link: string): string | null {
  if (link.trim().length > MAX_LINK_EXTERNO) {
    return `El link es demasiado largo: puede tener hasta ${MAX_LINK_EXTERNO} caracteres.`
  }
  return urlInvalida(link) ? MENSAJE_URL_INVALIDA : null
}

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
  /**
   * Lead ya elegido, cuando el alta sale de su ficha. Mismo reparto que
   * `leadFijo` en `ModalNuevaTarea`: el combobox se reemplaza por el nombre
   * como texto fijo, porque desde la ficha de un lead cambiarlo sería una
   * trampa.
   */
  leadFijo?: { id: string; nombre: string; apellido: string | null }
  /** Día preseleccionado. */
  fechaInicial: string
  onCerrar: () => void
  onCreada?: () => void
}

export function ModalNuevaVisita({
  propiedadFija,
  leadFijo,
  fechaInicial,
  onCerrar,
  onCreada,
}: ModalNuevaVisitaProps) {
  const { profile } = useAuth()
  const miId = profile?.id ?? ''
  const rol = profile?.rol

  // Con `propiedadFija` el selector no se muestra y el modo nunca sale de
  // Propia: desde la ficha de una propiedad no hay nada externo que cargar.
  const [modo, setModo] = useState<Modo>('propia')
  const [propiedadId, setPropiedadId] = useState<string | null>(
    propiedadFija?.id ?? null,
  )
  const [tituloExterno, setTituloExterno] = useState('')
  const [linkExterno, setLinkExterno] = useState('')
  // El error del link se muestra recién al salir del campo: mientras se
  // escribe "htt…" todavía no es un link, y avisarlo en cada tecla es ruido.
  const [linkTocado, setLinkTocado] = useState(false)
  const [leadId, setLeadId] = useState<string | null>(leadFijo?.id ?? null)
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

  const errorLink = modo === 'externa' ? errorDeLink(linkExterno) : null
  const faltaDestino =
    modo === 'propia' ? !propiedadId : !tituloExterno.trim() || errorLink !== null
  const faltaAlgo = faltaDestino || !fecha || !asignadoA || fechaPasada

  /**
   * Cambiar de modo descarta lo cargado en el otro —la propiedad elegida, o el
   * título y el link— para que no viaje nada que no se ve. Lead, fecha, hora,
   * responsable y notas sirven para los dos y se quedan.
   */
  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return
    setModo(nuevo)
    setPropiedadId(null)
    setEleccion(null)
    setTituloExterno('')
    setLinkExterno('')
    setLinkTocado(false)
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (faltaAlgo) {
      // Un Enter desde el campo del link llega acá sin pasar por el blur: sin
      // esto el submit no haría nada y no diría por qué.
      setLinkTocado(true)
      return
    }
    // El botón ya se deshabilita mientras guarda, pero un Enter repetido llega
    // por el submit del form sin pasar por él y crearía la visita dos veces.
    if (crear.isPending) return

    const comun = {
      lead_id: leadId,
      fecha,
      hora: hora || null,
      notas: notas || null,
      asignado_a: asignadoA,
    }

    crear.mutate(
      modo === 'propia' && propiedadId
        ? { ...comun, propiedad_id: propiedadId, operacion_id: operacionElegida?.id ?? null }
        : { ...comun, titulo_externo: tituloExterno, link_externo: linkExterno || null },
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
        <BotonCerrarModal onCerrar={onCerrar} />
        <h2 id="titulo-nueva-visita" className="m-0 pr-8 text-[1.05rem] font-bold text-ink">
          Agendar visita
        </h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">
          {propiedadFija
            ? 'Queda agendada para esta propiedad.'
            : modo === 'propia'
              ? 'Elegí la propiedad y, si el comprador es tu lead, seleccionalo.'
              : 'Cargá la dirección o el título y, si el comprador es tu lead, seleccionalo.'}
        </p>

        {/* Mismo control segmentado que el filtro de rol del listado. */}
        {!propiedadFija && (
          <div
            role="group"
            aria-label="Tipo de propiedad a visitar"
            className="mt-4 inline-flex rounded-full border border-border bg-surface p-0.5"
          >
            {MODOS.map((m) => {
              const activo = m.valor === modo
              return (
                <button
                  key={m.valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiarModo(m.valor)}
                  className={[
                    'rounded-full px-3.5 py-[5px] text-[0.82rem] font-semibold whitespace-nowrap',
                    'transition-colors motion-reduce:transition-none',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    activo ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-background hover:text-ink',
                  ].join(' ')}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          {modo === 'propia' ? (
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
          ) : (
            <>
              <div>
                <label htmlFor="visita-titulo-externo" className={etiquetaCampo}>
                  Título o dirección
                </label>
                <input
                  id="visita-titulo-externo"
                  type="text"
                  value={tituloExterno}
                  onChange={(e) => setTituloExterno(e.target.value)}
                  maxLength={MAX_TITULO_EXTERNO}
                  placeholder="Ej.: Güemes 2450, depto 3B"
                  className={campo}
                />
              </div>

              <div>
                <label htmlFor="visita-link-externo" className={etiquetaCampo}>
                  Link de la publicación <span className="normal-case">(opcional)</span>
                </label>
                <input
                  id="visita-link-externo"
                  type="url"
                  inputMode="url"
                  value={linkExterno}
                  onChange={(e) => setLinkExterno(e.target.value)}
                  onBlur={() => setLinkTocado(true)}
                  placeholder="https://..."
                  aria-invalid={(linkTocado && errorLink !== null) || undefined}
                  aria-describedby={linkTocado && errorLink ? 'visita-link-error' : undefined}
                  className={campo}
                />
                {linkTocado && errorLink && (
                  <p id="visita-link-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                    {errorLink}
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <span className={etiquetaCampo}>
              Lead comprador{!leadFijo &&<span className="normal-case"> (opcional)</span>}
            </span>
            {leadFijo ? (
              <p className="m-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[0.9rem] font-medium text-ink">
                {`${leadFijo.nombre} ${leadFijo.apellido ?? ''}`.trim()}
              </p>
            ) : (
              <>
                <ComboboxLead value={leadId} onChange={setLeadId} />
                <p className="mt-1.5 text-[0.75rem] text-ink-4">
                  {modo === 'propia'
                    ? 'Cargalo solo si el comprador es tu lead. Si lo trae otra inmobiliaria, dejalo vacío: la visita se agenda igual, pero al marcarla como realizada no se registra ninguna interacción.'
                    : 'Seleccioná al comprador que va a la visita (tu lead). Si lo dejás vacío, al marcarla como realizada no se registra ninguna interacción.'}
                </p>
              </>
            )}
          </div>

          {/* Una sola candidata: se vincula sola. Se avisa igual, para que no
              sea un comportamiento invisible. */}
          {candidatas.length === 1 && operacionElegida && (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[0.78rem] text-ink-3">
              Se vinculará a la operación{' '}
              <b className="font-semibold text-ink-2">{operacionElegida.titulo}</b> (
              {etiquetaTipoOperacion(operacionElegida.tipo)} ·{' '}
              {etiquetaEstadoOperacion(operacionElegida.tipo, operacionElegida.estado)}
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
                    {etiquetaEstadoOperacion(o.tipo, o.estado)}
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
            className="rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {crear.isPending ? 'Agendando…' : 'Agendar visita'}
          </button>
        </div>
      </form>
    </div>
  )
}
