import { useEffect, useState } from 'react'
import { ComboboxLead } from '../comunes/ComboboxLead'
import { useAuth } from '../../contexts/AuthContext'
import { useCrearTarea } from '../../hooks/useTareas'
import { MAX_OCURRENCIAS, generarFechas } from '../../lib/api/tareas'
import { esDiaPasado, hoyComoClave } from '../../lib/calendario'
import type { Miembro } from '../../lib/api/equipo'
import type { Recurrencia } from '../../types/database'

const RECURRENCIAS: { valor: Recurrencia; label: string }[] = [
  { valor: 'DIARIA', label: 'Todos los días' },
  { valor: 'SEMANAL', label: 'Cada semana' },
  { valor: 'MENSUAL', label: 'Cada mes' },
]

const etiquetaCampo = 'mb-1.5 block text-xs font-semibold text-ink-3 uppercase'
const campo =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]'

interface ModalNuevaTareaProps {
  /** Asistentes a los que se le puede asignar. Vacío para un dueño. */
  asistentes: Miembro[]
  /** Día preseleccionado, el que esté abierto en el calendario. */
  fechaInicial: string
  /**
   * Lead ya elegido, cuando el alta sale de su ficha.
   *
   * Con valor, el combobox se reemplaza por el nombre como texto fijo: desde
   * la ficha de un lead, poder cambiarlo por otro sería una trampa. Sin él
   * —abierto desde el calendario— el campo sigue siendo un combobox libre.
   * Mismo reparto que `propiedadFija` en `ModalNuevaVisita`.
   */
  leadFijo?: { id: string; nombre: string; apellido: string | null }
  onCerrar: () => void
}

export function ModalNuevaTarea({
  asistentes,
  fechaInicial,
  leadFijo,
  onCerrar,
}: ModalNuevaTareaProps) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(fechaInicial)
  const [hora, setHora] = useState('')
  const [asignadoA, setAsignadoA] = useState(asistentes[0]?.id ?? '')
  // Opcional a propósito: no entra en `faltaAlgo`. Una tarea suelta —"cerrar
  // la caja", "pedir las llaves"— no es de nadie en particular. Con `leadFijo`
  // el estado arranca ya resuelto y el combobox no llega a montarse.
  const [leadId, setLeadId] = useState<string | null>(leadFijo?.id ?? null)
  const [repite, setRepite] = useState(false)
  const [recurrencia, setRecurrencia] = useState<Recurrencia>('SEMANAL')
  const [hasta, setHasta] = useState('')

  const { profile } = useAuth()
  // El dueño no reparte trabajo: su tarea es siempre para él. Se saca el
  // selector en vez de dejarlo con una sola opción, que sería ruido.
  const esDueno = profile?.rol === 'DUENO'
  const destinatario = esDueno ? (profile?.id ?? '') : asignadoA

  const crear = useCrearTarea()

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  // Cuántas tareas saldrían: se calcula acá para avisar antes de mandar, con la
  // misma función que usa el alta, así los dos números no pueden discrepar.
  const ocurrencias =
    repite && hasta ? generarFechas(fecha, hasta, recurrencia).length : 0
  const demasiadas = ocurrencias > MAX_OCURRENCIAS
  const rangoInvalido = repite && !!hasta && ocurrencias === 0

  const hoy = hoyComoClave()
  const fechaPasada = !!fecha && esDiaPasado(fecha)
  // El fin de la serie no puede ser anterior ni a hoy ni al arranque: se toma
  // el más restrictivo de los dos.
  const minimoHasta = fecha > hoy ? fecha : hoy

  const faltaAlgo =
    !titulo.trim() ||
    !fecha ||
    !destinatario ||
    fechaPasada ||
    (repite && !hasta) ||
    demasiadas ||
    rangoInvalido

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (faltaAlgo) return
    // El botón ya se deshabilita mientras guarda, pero un Enter repetido llega
    // por el submit del form sin pasar por él y crearía la tarea dos veces.
    if (crear.isPending) return

    crear.mutate(
      {
        tarea: {
          titulo,
          descripcion: descripcion || null,
          fecha,
          hora: hora || null,
          asignado_a: destinatario,
          lead_id: leadId,
        },
        repeticion: repite ? { recurrencia, hasta } : undefined,
      },
      { onSuccess: onCerrar },
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
        aria-labelledby="titulo-nueva-tarea"
        className="my-auto w-full max-w-[460px] rounded-2xl bg-surface p-6 shadow-modal"
      >
        <h2 id="titulo-nueva-tarea" className="m-0 text-[1.05rem] font-bold text-ink">
          Nueva tarea
        </h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">
          {esDueno
            ? 'Queda en tu calendario, a tu nombre.'
            : 'Se la asignás a tu asistente y le aparece en su calendario.'}
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="tarea-titulo" className={etiquetaCampo}>
              Título
            </label>
            <input
              id="tarea-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              autoFocus
              placeholder="Llamar a los leads de la semana"
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="tarea-descripcion" className={etiquetaCampo}>
              Descripción <span className="normal-case">(opcional)</span>
            </label>
            <textarea
              id="tarea-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className={`${campo} resize-y`}
            />
          </div>

          {/* Mismo lugar que en `ModalNuevaVisita`: a quién se refiere la tarea
              va antes de cuándo. `<span>` y no `<label htmlFor>` porque el
              combobox no es un input suelto al que apuntar. */}
          <div>
            <span className={etiquetaCampo}>
              Lead{!leadFijo && <span className="normal-case"> (opcional)</span>}
            </span>
            {leadFijo ? (
              <p className="m-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[0.9rem] font-medium text-ink">
                {`${leadFijo.nombre} ${leadFijo.apellido ?? ''}`.trim()}
              </p>
            ) : (
              <>
                <ComboboxLead value={leadId} onChange={setLeadId} />
                <p className="mt-1.5 text-[0.75rem] text-ink-4">
                  Para lo que hay que hacer por un lead puntual. Sin vincular
                  queda como una tarea suelta de tu calendario.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tarea-fecha" className={etiquetaCampo}>
                Fecha
              </label>
              <input
                id="tarea-fecha"
                type="date"
                value={fecha}
                min={hoy}
                onChange={(e) => setFecha(e.target.value)}
                aria-invalid={fechaPasada || undefined}
                aria-describedby={fechaPasada ? 'tarea-fecha-error' : undefined}
                className={campo}
              />
              {fechaPasada && (
                <p id="tarea-fecha-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                  No se puede agendar para un día que ya pasó.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="tarea-hora" className={etiquetaCampo}>
                Hora <span className="normal-case">(opcional)</span>
              </label>
              <input
                id="tarea-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={campo}
              />
            </div>
          </div>

          {!esDueno && (
            <div>
              <label htmlFor="tarea-asignado" className={etiquetaCampo}>
                Para quién
              </label>
              <select
                id="tarea-asignado"
                value={asignadoA}
                onChange={(e) => setAsignadoA(e.target.value)}
                className={campo}
              >
                {asistentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} {a.apellido}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-border p-3.5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={repite}
                onChange={(e) => setRepite(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              <span className="text-[0.88rem] font-semibold text-ink">Repetir</span>
            </label>

            {repite && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tarea-recurrencia" className={etiquetaCampo}>
                    Cada cuánto
                  </label>
                  <select
                    id="tarea-recurrencia"
                    value={recurrencia}
                    onChange={(e) => setRecurrencia(e.target.value as Recurrencia)}
                    className={campo}
                  >
                    {RECURRENCIAS.map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tarea-hasta" className={etiquetaCampo}>
                    Hasta
                  </label>
                  <input
                    id="tarea-hasta"
                    type="date"
                    value={hasta}
                    min={minimoHasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className={campo}
                  />
                </div>

                {rangoInvalido ? (
                  <p className="col-span-2 text-[0.78rem] text-peligro-ink">
                    La fecha de fin tiene que ser posterior a la de la primera tarea.
                  </p>
                ) : demasiadas ? (
                  <p className="col-span-2 text-[0.78rem] text-peligro-ink">
                    Serían más de {MAX_OCURRENCIAS} tareas. Acortá la fecha de fin o
                    espaciá la repetición.
                  </p>
                ) : ocurrencias > 0 ? (
                  <p className="col-span-2 text-[0.78rem] text-ink-3">
                    Se van a crear <b className="text-ink">{ocurrencias}</b>{' '}
                    {ocurrencias === 1 ? 'tarea' : 'tareas'}.
                  </p>
                ) : null}
              </div>
            )}
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
            {crear.isPending ? 'Creando…' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </div>
  )
}
