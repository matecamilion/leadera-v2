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
import { useMediaQuery } from '../hooks/useMediaQuery'
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
  diasDeLaSemana,
  mesDeAncla,
  moverAncla,
  rangoVisible,
  sumarDias,
  tituloDeSemana,
  ubicarAlCambiarVista,
  vistaEfectiva,
  type VistaCalendario,
} from '../lib/vistaCalendario'
import type { VisitaConContexto } from '../lib/api/visitas'
import type { Tarea } from '../types/database'

export default function Tareas() {
  const { profile } = useAuth()
  const hoy = useMemo(() => new Date(), [])

  // La vista que eligió el usuario. Lo que se dibuja es `vistaVisible`: en una pantalla
  // chica la semana se ve como día, sin tocar lo elegido (al agrandar vuelve la semana).
  const [vista, setVista] = useState<VistaCalendario>('MES')
  const esPantallaChica = useMediaQuery('(max-width: 767.98px)')
  const vistaVisible = vistaEfectiva(vista, esPantallaChica)
  // La ancla ubica el calendario: de ella y de la vista salen el rango que se pide
  // y lo que se muestra. En el mes es independiente de `diaSel`: navegar de mes
  // mueve la ancla y deja el día seleccionado donde estaba. En la semana y en el día,
  // ancla y `diaSel` se mueven juntos al navegar, así el panel acompaña a la grilla.
  const [ancla, setAncla] = useState<string>(() => claveDia(hoy))
  const [diaSel, setDiaSel] = useState<string>(() => claveDia(hoy))
  // Semana achicada a día: el día que se muestra es el seleccionado (el que ya sigue el
  // panel), no la ancla, que puede ser otro día de esa semana.
  const anclaVisible = vistaVisible === vista ? ancla : diaSel
  const { ano, mes } = mesDeAncla(anclaVisible)
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
  const { desde, hasta } = useMemo(
    () => rangoVisible(vistaVisible, anclaVisible),
    [vistaVisible, anclaVisible],
  )
  const diasDeLaVista = useMemo(
    () => (vistaVisible === 'SEMANA' ? diasDeLaSemana(anclaVisible) : [anclaVisible]),
    [vistaVisible, anclaVisible],
  )

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

  /**
   * ‹ y ›: un mes en el mes, siete días en la semana, un día en el día. En la semana
   * el día seleccionado se corre lo mismo, así sigue siendo el mismo día de la semana.
   */
  function mover(delta: number) {
    const nueva = moverAncla(vistaVisible, anclaVisible, delta)
    setAncla(nueva)
    if (vistaVisible === 'DIA') setDiaSel(nueva)
    else if (vistaVisible === 'SEMANA') setDiaSel(sumarDias(diaSel, 7 * delta))
  }

  /** Cambia de vista conservando un día coherente (ver `ubicarAlCambiarVista`). */
  function cambiarVista(nueva: VistaCalendario) {
    if (nueva === vista) return
    const ubicacion = ubicarAlCambiarVista(vistaVisible, anclaVisible, diaSel)
    setAncla(ubicacion.ancla)
    setDiaSel(ubicacion.diaSel)
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

  // En pantallas chicas va la versión corta; el lector de pantalla lee siempre la
  // completa. En el mes ya es corto; en la semana omite el año; en el día, abreviado.
  const { tituloCorto, titulo } = tituloDeLaVista(vistaVisible, anclaVisible)
  const nombreDeLaVista = NOMBRE_DE_LA_VISTA[vistaVisible]

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
        <SelectorVista
          vista={vistaVisible}
          ofrecerSemana={!esPantallaChica}
          onCambiar={cambiarVista}
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={irAHoy}
            className="mr-1 h-9 shrink-0 rounded-lg border border-border bg-surface px-3 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Hoy
          </button>
          <BotonMes etiqueta={`${nombreDeLaVista} anterior`} onClick={() => mover(-1)}>
            ‹
          </BotonMes>
          <BotonMes etiqueta={`${nombreDeLaVista} siguiente`} onClick={() => mover(1)}>
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
            ) : vistaVisible === 'MES' ? (
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

const NOMBRE_DE_LA_VISTA: Record<VistaCalendario, string> = {
  MES: 'Mes',
  SEMANA: 'Semana',
  DIA: 'Día',
}

const VISTAS: { valor: VistaCalendario; etiqueta: string }[] = [
  { valor: 'MES', etiqueta: NOMBRE_DE_LA_VISTA.MES },
  { valor: 'SEMANA', etiqueta: NOMBRE_DE_LA_VISTA.SEMANA },
  { valor: 'DIA', etiqueta: NOMBRE_DE_LA_VISTA.DIA },
]

/** El título de la barra de navegación: el corto para pantallas chicas y el completo. */
function tituloDeLaVista(
  vista: VistaCalendario,
  ancla: string,
): { tituloCorto: string; titulo: string } {
  const fecha = desdeClaveDia(ancla)
  switch (vista) {
    case 'MES': {
      // En el mes ya es corto: los dos son iguales.
      const mes = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      return { tituloCorto: mes, titulo: mes }
    }
    case 'SEMANA': {
      const { corto, completo } = tituloDeSemana(ancla)
      return { tituloCorto: corto, titulo: completo }
    }
    case 'DIA':
      return {
        tituloCorto: fecha.toLocaleDateString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        titulo: fecha.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      }
  }
}

/** Mismo control segmentado que usa `ModalNuevaVisita`: botones con `aria-pressed`. */
function SelectorVista({
  vista,
  ofrecerSemana,
  onCambiar,
}: {
  vista: VistaCalendario
  /** En pantallas chicas la semana se ve como día: no se ofrece. */
  ofrecerSemana: boolean
  onCambiar: (vista: VistaCalendario) => void
}) {
  return (
    <div
      role="group"
      aria-label="Vista del calendario"
      className="inline-flex rounded-full border border-border bg-surface p-0.5"
    >
      {VISTAS.filter((v) => ofrecerSemana || v.valor !== 'SEMANA').map((v) => {
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
