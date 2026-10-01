import { Link, useSearchParams } from 'react-router-dom'
import { BarraTabs } from '../components/comunes/BarraTabs'
import { BarraLinkGeneral, InvitacionCompartir } from '../components/consultas/BarraLinkGeneral'
import { FilaConsulta } from '../components/consultas/FilaConsulta'
import { minutosDesde, UMBRAL_URGENTE_MIN, useAhora } from '../components/consultas/urgencia'
import { Paginacion } from '../components/leads/Paginacion'
import { useAuth } from '../contexts/AuthContext'
import { useConsultas, useVolvieronAConsultar } from '../hooks/useConsultas'
import { useEquipo } from '../hooks/useEquipo'
import {
  DIAS_ARCHIVO,
  DIAS_VOLVIERON,
  FILTROS_CONSULTAS,
  POR_PAGINA,
  type Consulta,
  type FiltroConsultas,
} from '../lib/api/consultas'
import { leerPagina } from '../lib/parametrosDeUrl'

/** El nombre, con link a la ficha del lead al que quedó vinculada. */
function LinkLead({ consulta: v }: { consulta: Consulta }) {
  const nombre = `${v.nombre} ${v.apellido ?? ''}`.trim()
  if (!v.lead_id) return <span className="font-semibold text-ink">{nombre}</span>
  return (
    <Link to={`/leads/${v.lead_id}`} className="font-semibold text-primary hover:underline">
      {nombre}
    </Link>
  )
}

const VACIO: Record<FiltroConsultas, { titulo: string; texto: string }> = {
  pendientes: {
    titulo: 'Bandeja al día',
    texto: 'No hay consultas esperando. Las que lleguen por tu link y no pasen solas a Nuevos van a aparecer acá.',
  },
  aceptadas: { titulo: 'Todavía no aceptaste ninguna', texto: 'Acá quedan las que pasaron a Nuevos, a mano o solas.' },
  vinculadas: {
    titulo: 'Sin vinculadas',
    texto: 'Acá quedan las consultas de personas que ya eran leads.',
  },
  descartadas: { titulo: 'Sin descartadas', texto: 'Acá quedan las que descartaste, con su motivo.' },
  archivadas: {
    titulo: 'Sin archivadas',
    texto: `Una consulta pendiente se archiva sola a los ${DIAS_ARCHIVO} días sin resolver.`,
  },
}

function IconoTilde() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** Un grupo de filas: un solo contenedor con divisores, no tarjetas apiladas. */
function Grupo({
  titulo,
  urgente = false,
  consultas,
  ahora,
  conEspera = true,
}: {
  titulo?: string
  urgente?: boolean
  consultas: Consulta[]
  ahora: number
  conEspera?: boolean
}) {
  if (consultas.length === 0) return null
  return (
    <section className="mb-5" aria-label={titulo}>
      {titulo && (
        // Pegajoso debajo del header de la app (h-16): al bajar por un grupo
        // largo se sigue sabiendo en cuál se está.
        <h2 className="sticky top-16 z-10 m-0 flex items-center gap-2 bg-background py-2 text-[0.78rem] font-bold text-ink-3">
          {titulo}
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[0.7rem] tabular-nums',
              urgente ? 'bg-badge-caliente-bg text-caliente' : 'bg-surface-2 text-ink-3',
            ].join(' ')}
          >
            {consultas.length}
          </span>
        </h2>
      )}
      <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface p-0 shadow-sm">
        {consultas.map((c) => (
          <FilaConsulta key={c.id} consulta={c} ahora={ahora} conEspera={conEspera} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Bandeja de consultas del link público: una bandeja de decisión rápida.
 *
 * Las pendientes se agrupan por cuánto llevan esperando —más de 4 h arriba—:
 * la urgencia se lee por posición, sin teñir cada fila. Adentro de cada grupo
 * se respeta el orden de la query (lo que pide acción del dueño y lo trabado
 * primero; después, por puntaje).
 *
 * El filtro, el agente y la página viven en la URL (`?estado=&agente=&page=`),
 * con la misma convención que Leads.
 */
export default function Consultas() {
  const { profile } = useAuth()
  const esDueno = profile?.rol === 'DUENO'
  const [searchParams, setSearchParams] = useSearchParams()
  const ahora = useAhora()

  const filtro =
    FILTROS_CONSULTAS.find((f) => f.id === searchParams.get('estado'))?.id ?? 'pendientes'
  const agenteId = esDueno ? (searchParams.get('agente') ?? '') : ''
  const page = leerPagina(searchParams.get('page'))

  const lista = useConsultas(filtro, page, agenteId)
  const volvieron = useVolvieronAConsultar(agenteId, filtro === 'pendientes' && page === 1)
  const equipo = useEquipo(esDueno ? profile?.rol : undefined, profile?.id)
  const agentes = (equipo.data ?? []).filter((m) => m.rol !== 'ASISTENTE')

  function escribir(cambios: { estado?: FiltroConsultas; agente?: string; page?: number }) {
    const proximos = new URLSearchParams(searchParams)
    const estado = cambios.estado ?? filtro
    const agente = cambios.agente ?? agenteId
    if (estado === 'pendientes') proximos.delete('estado')
    else proximos.set('estado', estado)
    if (agente) proximos.set('agente', agente)
    else proximos.delete('agente')
    const p = cambios.page ?? 1
    if (p > 1) proximos.set('page', String(p))
    else proximos.delete('page')
    setSearchParams(proximos)
  }

  const total = lista.data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const consultas = lista.data?.consultas ?? []

  const urgentes =
    filtro === 'pendientes' ? consultas.filter((c) => minutosDesde(c.created_at, ahora) >= UMBRAL_URGENTE_MIN) : []
  const recientes =
    filtro === 'pendientes' ? consultas.filter((c) => minutosDesde(c.created_at, ahora) < UMBRAL_URGENTE_MIN) : []

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.4rem] leading-tight font-bold text-ink">Consultas</h1>
          <p className="mt-0.5 mb-0 text-[0.85rem] text-ink-3">
            Lo que llega por tu link. Aceptá lo que vale la pena: pasa a Nuevos.
          </p>
        </div>

        {esDueno && agentes.length > 1 && (
          <label className="flex items-center gap-2 text-[0.82rem] text-ink-3 sm:ml-auto">
            Agente
            <select
              value={agenteId}
              onChange={(e) => escribir({ agente: e.target.value })}
              className="min-h-[38px] rounded-lg border border-border bg-surface px-2.5 text-[0.85rem] text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
            >
              <option value="">Todos</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {`${a.nombre} ${a.apellido}`.trim()}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <BarraLinkGeneral />

      <BarraTabs
        etiqueta="Estado de las consultas"
        tabs={FILTROS_CONSULTAS.map((f) => ({
          id: f.id,
          label: f.label,
          ...(f.id === filtro && lista.data ? { n: total } : {}),
        }))}
        activa={filtro}
        onCambiar={(id) => escribir({ estado: id })}
      />

      {/* Los que volvieron a consultar ya quedaron vinculados solos: no piden
          acción, pero el agente se tiene que enterar. Desaparecen a los 7 días. */}
      {filtro === 'pendientes' && page === 1 && (volvieron.data?.length ?? 0) > 0 && (
        <section className="mb-5 rounded-2xl bg-cool-soft px-4 py-3">
          <h2 className="m-0 text-[0.86rem] font-bold text-info">Volvieron a consultar</h2>
          <p className="mt-0.5 mb-2 text-[0.78rem] text-ink-3">
            Ya eran leads; la consulta quedó en su ficha. Últimos {DIAS_VOLVIERON} días.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {volvieron.data!.map((v) => (
              // Texto corrido: cada "·" va pegado con &nbsp; a lo anterior, así
              // al cortar el renglón nunca queda suelto al principio.
              <li key={v.id} className="text-[0.84rem] leading-snug">
                <LinkLead consulta={v} />
                <span className="text-ink-3">
                  &nbsp;· {v.propiedad ? `por ${v.propiedad.direccion}` : 'link general'}&nbsp;·{' '}
                  {v.puntaje}&nbsp;pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando consultas" className="overflow-hidden rounded-2xl border border-border bg-surface">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0">
              <div className="size-12 shrink-0 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3.5 w-40 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
                <div className="h-3 w-64 max-w-full animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      ) : lista.isError ? (
        <p role="alert" className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink">
          {lista.error instanceof Error ? lista.error.message : 'No se pudieron cargar las consultas.'}
        </p>
      ) : consultas.length === 0 ? (
        filtro === 'pendientes' ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-primary">
              <IconoTilde />
            </span>
            <h2 className="mt-4 mb-0 text-[1.15rem] font-bold text-ink">{VACIO.pendientes.titulo}</h2>
            <p className="mt-1.5 mb-0 max-w-[42ch] text-[0.88rem] text-ink-3">{VACIO.pendientes.texto}</p>
            <InvitacionCompartir />
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <h2 className="m-0 text-[1rem] font-bold text-ink">{VACIO[filtro].titulo}</h2>
            <p className="mx-auto mt-1.5 mb-0 max-w-[42ch] text-[0.88rem] text-ink-3">{VACIO[filtro].texto}</p>
          </div>
        )
      ) : (
        <div className={lista.isPlaceholderData ? 'opacity-60' : ''}>
          {filtro === 'pendientes' ? (
            <>
              <Grupo titulo="Esperan hace más de 4 h" urgente consultas={urgentes} ahora={ahora} />
              <Grupo titulo="Últimas 4 horas" consultas={recientes} ahora={ahora} />
            </>
          ) : (
            <>
              {filtro === 'archivadas' && (
                <p className="mt-0 mb-3 text-[0.82rem] text-ink-3">
                  Pendientes con más de {DIAS_ARCHIVO} días. No cuentan en el número del menú, pero
                  todavía las podés aceptar o descartar.
                </p>
              )}
              <Grupo consultas={consultas} ahora={ahora} conEspera={filtro !== 'archivadas'} />
            </>
          )}

          {totalPaginas > 1 && (
            <div className="mt-2">
              <Paginacion page={page} totalPaginas={totalPaginas} onCambiar={(p) => escribir({ page: p })} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
