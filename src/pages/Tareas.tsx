import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarioMes } from '../components/tareas/CalendarioMes'
import { ModalNuevaTarea } from '../components/tareas/ModalNuevaTarea'
import { ModalNuevaVisita } from '../components/tareas/ModalNuevaVisita'
import { PanelDiaTareas } from '../components/tareas/PanelDiaTareas'
import { IconoCasa, IconoMas } from '../components/leads/Iconos'
import { useAuth } from '../contexts/AuthContext'
import { useEquipo } from '../hooks/useEquipo'
import {
  useCompletarTarea,
  useDescompletarTarea,
  useEliminarTarea,
  useEventosCalendario,
} from '../hooks/useTareas'
import {
  useCancelarVisita,
  useEliminarVisita,
  useMarcarRealizada,
} from '../hooks/useVisitas'
import { claveDia, diasDeLaGrilla } from '../lib/calendario'
import type { VisitaConContexto } from '../lib/api/visitas'
import type { Tarea } from '../types/database'

export default function Tareas() {
  const { profile } = useAuth()
  const hoy = useMemo(() => new Date(), [])

  const [ano, setAno] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [diaSel, setDiaSel] = useState<string>(() => claveDia(hoy))
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalVisita, setModalVisita] = useState(false)
  // Día que pidió el doble click. Cuando el modal se abre por el botón queda
  // en null y manda el día seleccionado.
  const [fechaPrellenada, setFechaPrellenada] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rol = profile?.rol
  const miId = profile?.id ?? ''
  const esAgente = rol === 'AGENTE'
  // El dueño usa la pantalla para su propia agenda: crea tareas a su nombre,
  // pero no le asigna nada a nadie, así que nunca necesita el equipo.
  const esDueno = rol === 'DUENO'
  const puedeCrear = esAgente || esDueno

  // El rango que se pide es el de la grilla completa, no el del mes: si no, los
  // días de relleno saldrían siempre vacíos aunque tengan eventos.
  const { desde, hasta } = useMemo(() => {
    const dias = diasDeLaGrilla(ano, mes)
    return { desde: claveDia(dias[0]), hasta: claveDia(dias[dias.length - 1]) }
  }, [ano, mes])

  const eventos = useEventosCalendario(desde, hasta)
  // Los asistentes salen de la misma fuente que usa Equipo: para un AGENTE,
  // `listarEquipo` devuelve exactamente la gente que lo asiste.
  const equipo = useEquipo(esAgente ? rol : undefined, esAgente ? miId : undefined)

  const completar = useCompletarTarea()
  const descompletar = useDescompletarTarea()
  const borrar = useEliminarTarea()

  const realizar = useMarcarRealizada()
  const cancelar = useCancelarVisita()
  const borrarVisita = useEliminarVisita()

  const delDia = useMemo(
    () => (eventos.data ?? []).filter((e) => e.fecha === diaSel),
    [eventos.data, diaSel],
  )

  const asistentes = equipo.data ?? []
  const sinAsistentes = esAgente && equipo.isSuccess && asistentes.length === 0

  function abrirModal(fecha: string | null) {
    setFechaPrellenada(fecha)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setFechaPrellenada(null)
  }

  function moverMes(delta: number) {
    const d = new Date(ano, mes + delta, 1)
    setAno(d.getFullYear())
    setMes(d.getMonth())
  }

  function alternarCompletada(tarea: Tarea) {
    setError(null)
    const mutacion = tarea.estado === 'COMPLETADA' ? descompletar : completar
    mutacion.mutate(tarea.id, { onError: (e) => setError(e.message) })
  }

  function eliminar(tarea: Tarea) {
    setError(null)
    borrar.mutate(tarea.id, { onError: (e) => setError(e.message) })
  }

  function realizarVisita(visita: VisitaConContexto) {
    setError(null)
    realizar.mutate(visita.id, { onError: (e) => setError(e.message) })
  }

  function cancelarLaVisita(visita: VisitaConContexto) {
    setError(null)
    cancelar.mutate(visita.id, { onError: (e) => setError(e.message) })
  }

  function eliminarLaVisita(visita: VisitaConContexto) {
    setError(null)
    borrarVisita.mutate(visita.id, { onError: (e) => setError(e.message) })
  }

  const nombreMes = new Date(ano, mes, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Agenda
          </p>
          <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Tareas</h1>
          <p className="mt-1 text-[0.9rem] text-ink-3">
            {esAgente
              ? 'Lo que le asignaste a tu asistente y tus seguimientos de leads.'
              : esDueno
                ? 'Tu agenda: tus tareas y tus seguimientos de leads.'
                : 'Lo que tenés asignado, día por día.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <BotonMes etiqueta="Mes anterior" onClick={() => moverMes(-1)}>
              ‹
            </BotonMes>
            <span // `capitalize` pondría "Agosto De 2026": sólo va la primera letra.
              className="min-w-[10rem] text-center text-[0.95rem] font-bold text-ink first-letter:uppercase">
              {nombreMes}
            </span>
            <BotonMes etiqueta="Mes siguiente" onClick={() => moverMes(1)}>
              ›
            </BotonMes>
          </div>

          {puedeCrear && !sinAsistentes && (
            <button
              type="button"
              onClick={() => abrirModal(null)}
              // Un agente sin asistentes no tiene a quién asignarle; un dueño
              // se la asigna a sí mismo, así que nunca queda bloqueado.
              disabled={!esDueno && asistentes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark disabled:opacity-55 motion-reduce:transition-none"
            >
              <IconoMas className="size-5" />
              Nueva tarea
            </button>
          )}

          {/* Sin restricción de rol: agendar una visita a su nombre es algo que
              hace cualquiera, incluido un asistente. */}
          <button
            type="button"
            onClick={() => setModalVisita(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background motion-reduce:transition-none"
          >
            <IconoCasa className="size-5" />
            Agendar visita
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error}
        </p>
      )}

      {/* Antes este aviso REEMPLAZABA el calendario, cuando lo único que había
          acá era asignarle tareas a un asistente. Ahora la grilla también trae
          seguimientos y visitas, que un agente sin asistentes sí tiene: pasa a
          ser una nota arriba y deja de tapar la pantalla. */}
      {sinAsistentes && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3">
          <p className="m-0 text-[0.85rem] text-ink-3">
            Todavía no tenés asistentes para asignarles tareas. Podés agendar
            visitas y ver tus seguimientos igual.
          </p>
          <Link
            to="/equipo"
            className="shrink-0 text-[0.85rem] font-semibold text-primary hover:underline"
          >
            Ir a Equipo →
          </Link>
        </div>
      )}

      {eventos.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {eventos.error.message}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {eventos.isPending ? (
            <div
              aria-busy="true"
              aria-label="Cargando el calendario"
              className="h-[520px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
            />
          ) : (
            <CalendarioMes
              ano={ano}
              mes={mes}
              eventos={eventos.data}
              diaSeleccionado={diaSel}
              onSelectDia={setDiaSel}
              onNuevaTareaEnDia={puedeCrear ? abrirModal : undefined}
            />
          )}

          <PanelDiaTareas
            dia={diaSel}
            eventos={delDia}
            miId={miId}
            idCambiando={
              completar.isPending || descompletar.isPending
                ? ((completar.variables ?? descompletar.variables) ?? null)
                : null
            }
            idEliminando={borrar.isPending ? (borrar.variables ?? null) : null}
            onAlternarCompletada={alternarCompletada}
            onEliminar={eliminar}
            idVisitaCambiando={
              realizar.isPending || cancelar.isPending
                ? ((realizar.variables ?? cancelar.variables) ?? null)
                : null
            }
            idVisitaEliminando={
              borrarVisita.isPending ? (borrarVisita.variables ?? null) : null
            }
            onMarcarRealizada={realizarVisita}
            onCancelarVisita={cancelarLaVisita}
            onEliminarVisita={eliminarLaVisita}
          />
        </div>
      )}

      {modalAbierto && (
        <ModalNuevaTarea
          asistentes={asistentes}
          fechaInicial={fechaPrellenada ?? diaSel}
          onCerrar={cerrarModal}
        />
      )}

      {modalVisita && (
        <ModalNuevaVisita
          fechaInicial={diaSel}
          onCerrar={() => setModalVisita(false)}
        />
      )}
    </div>
  )
}

function BotonMes({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-[1.1rem] text-ink-2 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}
