import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BannerConectarGoogle } from '../components/tareas/BannerConectarGoogle'
import { BotonActualizarCalendario } from '../components/tareas/BotonActualizarCalendario'
import { CalendarioMes } from '../components/tareas/CalendarioMes'
import { GrillaHoraria } from '../components/tareas/GrillaHoraria'
import { ModalNuevaTarea } from '../components/tareas/ModalNuevaTarea'
import { ModalNuevaVisita } from '../components/tareas/ModalNuevaVisita'
import { PanelDiaTareas } from '../components/tareas/PanelDiaTareas'
import { CLASES_CALENDARIO_FIJO } from '../components/tareas/calendarioFijo'
import { IconoCasa, IconoMas } from '../components/leads/Iconos'
import { useAuth } from '../contexts/AuthContext'
import { useEquipo } from '../hooks/useEquipo'
import { useEquipoCalendario } from '../hooks/useEquipoCalendario'
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
import { claveDia, desdeClaveDia, hoyComoClave } from '../lib/calendario'
import {
  mesDeAncla,
  moverAncla,
  rangoVisible,
  type VistaCalendario,
} from '../lib/vistaCalendario'
import type { VisitaConContexto } from '../lib/api/visitas'
import type { Tarea } from '../types/database'

export default function Tareas() {
  const { profile } = useAuth()
  const hoy = useMemo(() => new Date(), [])

  const [vista, setVista] = useState<VistaCalendario>('MES')
  // La ancla ubica el calendario: de ella y de la vista salen el rango que se pide
  // y lo que se muestra. En el mes es independiente de `diaSel`: navegar de mes
  // mueve la ancla y deja el día seleccionado donde estaba. En el día, ancla y
  // `diaSel` son el mismo día: la grilla muestra el que el panel detalla.
  const [ancla, setAncla] = useState<string>(() => claveDia(hoy))
  const { ano, mes } = mesDeAncla(ancla)
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
  const esDueno = rol === 'DUENO'

  // El rango que se pide es el de la grilla completa, no el del mes: si no, los
  // días de relleno saldrían siempre vacíos aunque tengan eventos.
  const { desde, hasta } = useMemo(() => rangoVisible(vista, ancla), [vista, ancla])
  const diasDeLaVista = useMemo(() => [ancla], [ancla])

  const eventos = useEventosCalendario(desde, hasta)
  const { equipo: equipoCalendario } = useEquipoCalendario()
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

  /** ‹ y ›: un mes en el mes, un día en el día. */
  function mover(delta: number) {
    const nueva = moverAncla(vista, ancla, delta)
    setAncla(nueva)
    if (vista === 'DIA') setDiaSel(nueva)
  }

  /**
   * Cambia de vista conservando la ancla, así el día que se ve es coherente con el
   * mes que se veía. Al pasar al día se muestra el día seleccionado si cae en el mes
   * visible; si no, el de la ancla.
   */
  function cambiarVista(nueva: VistaCalendario) {
    if (nueva === vista) return
    if (nueva === 'DIA') {
      const delMes = mesDeAncla(diaSel).ano === ano && mesDeAncla(diaSel).mes === mes
      const dia = delMes ? diaSel : ancla
      setAncla(dia)
      setDiaSel(dia)
    }
    setVista(nueva)
  }

  /** Vuelve al día de hoy y lo selecciona: el panel pasa a mostrar el de hoy. */
  function irAHoy() {
    const hoyClave = hoyComoClave()
    setAncla(hoyClave)
    setDiaSel(hoyClave)
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

  // En el mes ya es corto; en el día, la versión chica va sin año y abreviada.
  const tituloCorto =
    vista === 'MES'
      ? new Date(ano, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : desdeClaveDia(ancla).toLocaleDateString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })

  const titulo =
    vista === 'MES'
      ? new Date(ano, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : desdeClaveDia(ancla).toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
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
          <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Calendario</h1>
          {/* Las tres variantes nombran las visitas, no sólo una: agendar una
              visita no tiene restricción de rol, así que la grilla las muestra
              igual para el dueño, el agente y el asistente. */}
          <p className="mt-1 text-[0.9rem] text-ink-3">
            {esAgente
              ? 'Lo que le asignaste a tu asistente, tus visitas y tus seguimientos de leads.'
              : esDueno
                ? 'Tu agenda: tus tareas, tus visitas y tus seguimientos de leads.'
                : 'Lo que tenés asignado y las visitas agendadas, día por día.'}
          </p>
        </div>

        {/* Las acciones de crear, juntas y a la derecha. "Nueva tarea" es la
            principal. Si no entran, envuelven alineadas entre sí. */}
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
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

          {/* Todos los roles crean tareas: como mínimo para sí mismos, y además
              para quien les toca según el rol (lo resuelve el modal). */}
          <button
            type="button"
            onClick={() => abrirModal(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-55 motion-reduce:transition-none"
          >
            <IconoMas className="size-5" />
            Nueva tarea
          </button>
        </div>
      </header>

      <BannerConectarGoogle />

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
            Todavía no tenés asistentes para asignarles tareas. Mientras tanto
            podés crearte tareas a vos, agendar visitas y ver tus seguimientos.
          </p>
          <Link
            to="/equipo"
            className="shrink-0 text-[0.85rem] font-semibold text-primary hover:underline"
          >
            Ir a Equipo →
          </Link>
        </div>
      )}

      {/* Navegación del calendario: vista, Hoy y flechas juntos a la izquierda, el
          título a continuación. El título es lo único que cambia de largo y va
          al final, así que no corre nada de lo anterior. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SelectorVista vista={vista} onCambiar={cambiarVista} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={irAHoy}
            className="mr-1 h-9 shrink-0 rounded-lg border border-border bg-surface px-3 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Hoy
          </button>
          <BotonMes etiqueta={vista === 'MES' ? 'Mes anterior' : 'Día anterior'} onClick={() => mover(-1)}>
            ‹
          </BotonMes>
          <BotonMes etiqueta={vista === 'MES' ? 'Mes siguiente' : 'Día siguiente'} onClick={() => mover(1)}>
            ›
          </BotonMes>
        </div>

        <h2 // `capitalize` pondría "Agosto De 2026": sólo va la primera letra.
          className="m-0 min-w-0 text-[0.95rem] font-bold text-ink first-letter:uppercase"
        >
          {/* En pantallas chicas, la versión corta; el lector de pantalla lee siempre la completa. */}
          <span aria-hidden className="sm:hidden">
            {tituloCorto}
          </span>
          <span className="sr-only sm:not-sr-only">{titulo}</span>
        </h2>

        {/* Solo dueño/agente con Google conectado e importación activa. */}
        <div className="ml-auto">
          <BotonActualizarCalendario />
        </div>
      </div>

      {eventos.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {eventos.error.message}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* El wrapper es lo que se fija: el `overflow-hidden` de la grilla
              está en su propio contenedor y no corta el sticky de un padre. */}
          <div className={CLASES_CALENDARIO_FIJO}>
            {eventos.isPending ? (
              <div
                aria-busy="true"
                aria-label="Cargando el calendario"
                className="h-[520px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
              />
            ) : vista === 'MES' ? (
              <CalendarioMes
                ano={ano}
                mes={mes}
                eventos={eventos.data}
                diaSeleccionado={diaSel}
                onSelectDia={setDiaSel}
                onNuevaTareaEnDia={abrirModal}
              />
            ) : (
              <GrillaHoraria
                dias={diasDeLaVista}
                eventos={eventos.data}
                diaSeleccionado={diaSel}
                onSelectDia={setDiaSel}
              />
            )}
          </div>

          <PanelDiaTareas
            dia={diaSel}
            eventos={delDia}
            equipoIds={equipoCalendario?.equipoIds ?? [miId]}
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

const VISTAS: { valor: VistaCalendario; etiqueta: string }[] = [
  { valor: 'MES', etiqueta: 'Mes' },
  { valor: 'DIA', etiqueta: 'Día' },
]

/** Mismo control segmentado que usa `ModalNuevaVisita`: botones con `aria-pressed`. */
function SelectorVista({
  vista,
  onCambiar,
}: {
  vista: VistaCalendario
  onCambiar: (vista: VistaCalendario) => void
}) {
  return (
    <div
      role="group"
      aria-label="Vista del calendario"
      className="inline-flex rounded-full border border-border bg-surface p-0.5"
    >
      {VISTAS.map((v) => {
        const activa = v.valor === vista
        return (
          <button
            key={v.valor}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(v.valor)}
            className={[
              'rounded-full px-3.5 py-[5px] text-[0.82rem] font-semibold whitespace-nowrap',
              'transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activa ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-background hover:text-ink',
            ].join(' ')}
          >
            {v.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
