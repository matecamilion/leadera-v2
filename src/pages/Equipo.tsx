import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { IndicadorCupo } from '../components/equipo/IndicadorCupo'
import { ListaInvitacionesPendientes } from '../components/equipo/ListaInvitacionesPendientes'
import { ModalInvitar } from '../components/equipo/ModalInvitar'
import { SeccionEstadisticasEquipo } from '../components/equipo/SeccionEstadisticasEquipo'
import { TablaLeadsEquipo } from '../components/equipo/TablaLeadsEquipo'
import { TablaMiembros } from '../components/equipo/TablaMiembros'
import { ModalConfirmarActivo } from '../components/equipo/ModalConfirmarActivo'
import { IconoPersonaMas } from '../components/leads/Iconos'
import { useAuth } from '../contexts/AuthContext'
import {
  LEADS_EQUIPO_POR_PAGINA,
  useCupoEquipo,
  useEquipo,
  useInvitacionesPendientes,
  useLeadsDelEquipo,
  useStatsEquipo,
  useToggleActivo,
} from '../hooks/useEquipo'
import type { Miembro } from '../lib/api/equipo'

type Tab = 'miembros' | 'stats' | 'leads' | 'invitaciones'

export default function Equipo() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('miembros')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [aCambiar, setACambiar] = useState<Miembro | null>(null)
  const [page, setPage] = useState(1)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const rol = profile?.rol
  const miId = profile?.id
  const esDueno = rol === 'DUENO'

  const miembros = useEquipo(rol, miId)
  const cupo = useCupoEquipo()
  const stats = useStatsEquipo(tab === 'stats')
  const leads = useLeadsDelEquipo(page, esDueno && tab === 'leads')
  const invitaciones = useInvitacionesPendientes(tab === 'invitaciones')
  const toggle = useToggleActivo()

  // Sólo agentes y dueños pueden tener un asistente asignado.
  const agentesAsignables = useMemo(
    () => (miembros.data ?? []).filter((m) => m.rol !== 'ASISTENTE'),
    [miembros.data],
  )

  // Un asistente no tiene nada que hacer acá. El link del sidebar tampoco se
  // le muestra; esto cubre el caso de entrar escribiendo la URL.
  if (profile && profile.rol === 'ASISTENTE') {
    return <Navigate to="/mi-dia" replace />
  }

  // Sólo se bloquea el botón cuando se SABE que no hay lugar. Con el límite
  // desconocido se deja invitar: quien decide es `crear-invitacion`, que
  // devuelve el error de cupo con los números reales.
  const sinCupo =
    cupo.data?.limite != null && cupo.data.usados >= cupo.data.limite

  const TABS: { valor: Tab; label: string }[] = [
    { valor: 'miembros', label: 'Miembros' },
    { valor: 'stats', label: 'Estadísticas' },
    ...(esDueno ? [{ valor: 'leads' as Tab, label: 'Leads del equipo' }] : []),
    { valor: 'invitaciones', label: 'Invitaciones' },
  ]

  function confirmarCambio() {
    if (!aCambiar) return
    setErrorGeneral(null)
    toggle.mutate(
      { profileId: aCambiar.id, activo: !aCambiar.activo },
      {
        onSuccess: () => setACambiar(null),
        onError: (e) => {
          setErrorGeneral(e.message)
          setACambiar(null)
        },
      },
    )
  }

  const totalPaginas = Math.max(
    1,
    Math.ceil((leads.data?.count ?? 0) / LEADS_EQUIPO_POR_PAGINA),
  )

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Mi inmobiliaria
          </p>
          <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Equipo</h1>
          <p className="mt-1 text-[0.9rem] text-ink-3">
            {esDueno
              ? 'Sumá agentes y asistentes, y mirá cómo viene el equipo.'
              : 'Tu asistente y cómo viene tu cartera.'}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
          {cupo.data && <IndicadorCupo cupo={cupo.data} />}

          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            disabled={sinCupo}
            title={sinCupo ? 'No te quedan lugares en el plan' : undefined}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
          >
            <IconoPersonaMas className="size-5" />
            Invitar
          </button>
        </div>
      </header>

      {errorGeneral && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {errorGeneral}
        </p>
      )}

      <nav
        role="tablist"
        aria-label="Secciones del equipo"
        className="mb-5 flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => {
          const activa = t.valor === tab
          return (
            <button
              key={t.valor}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setTab(t.valor)}
              className={[
                '-mb-px border-b-2 px-3.5 py-2.5 text-[0.88rem] font-semibold',
                'transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                activa
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink-2',
              ].join(' ')}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {tab === 'miembros' && (
        <Seccion
          cargando={miembros.isPending}
          error={miembros.isError ? miembros.error.message : null}
        >
          {miembros.data && (
            <TablaMiembros
              miembros={miembros.data}
              puedeGestionar={esDueno}
              miId={miId ?? ''}
              cambiandoId={toggle.isPending ? (aCambiar?.id ?? null) : null}
              onToggleActivo={setACambiar}
            />
          )}
        </Seccion>
      )}

      {tab === 'stats' && (
        <Seccion cargando={stats.isPending} error={stats.isError ? stats.error.message : null}>
          {stats.data && <SeccionEstadisticasEquipo stats={stats.data} />}
        </Seccion>
      )}

      {tab === 'leads' && esDueno && (
        <Seccion cargando={leads.isPending} error={leads.isError ? leads.error.message : null}>
          {leads.data && (
            <TablaLeadsEquipo
              leads={leads.data.data}
              total={leads.data.count}
              page={page}
              totalPaginas={totalPaginas}
              onCambiarPagina={setPage}
            />
          )}
        </Seccion>
      )}

      {tab === 'invitaciones' && (
        <Seccion
          cargando={invitaciones.isPending}
          error={invitaciones.isError ? invitaciones.error.message : null}
        >
          {invitaciones.data && (
            <ListaInvitacionesPendientes invitaciones={invitaciones.data} />
          )}
        </Seccion>
      )}

      {modalAbierto && rol && miId && (
        <ModalInvitar
          miRol={rol}
          miId={miId}
          agentes={agentesAsignables}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {aCambiar && (
        <ModalConfirmarActivo
          miembro={aCambiar}
          guardando={toggle.isPending}
          onConfirmar={confirmarCambio}
          onCancelar={() => setACambiar(null)}
        />
      )}
    </div>
  )
}

function Seccion({
  cargando,
  error,
  children,
}: {
  cargando: boolean
  error: string | null
  children: React.ReactNode
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (cargando) {
    return (
      <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  return <>{children}</>
}
