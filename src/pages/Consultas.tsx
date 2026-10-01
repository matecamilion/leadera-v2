import { Link, useSearchParams } from 'react-router-dom'
import { BarraTabs } from '../components/comunes/BarraTabs'
import { TarjetaConsulta } from '../components/consultas/TarjetaConsulta'
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
    titulo: 'No tenés consultas por revisar',
    texto: 'Las que lleguen por tu link de consultas y no pasen solas a Nuevos van a aparecer acá.',
  },
  aceptadas: { titulo: 'Todavía no hay aceptadas', texto: 'Acá quedan las que pasaron a Nuevos.' },
  vinculadas: {
    titulo: 'No hay vinculadas',
    texto: 'Acá quedan las consultas de personas que ya eran leads.',
  },
  descartadas: { titulo: 'No hay descartadas', texto: 'Acá quedan las que descartaste, con su motivo.' },
  archivadas: {
    titulo: 'No hay archivadas',
    texto: `Una consulta pendiente se archiva sola a los ${DIAS_ARCHIVO} días sin resolver.`,
  },
}

/**
 * Bandeja de consultas del link público.
 *
 * El filtro, el agente y la página viven en la URL (`?estado=&agente=&page=`),
 * con la misma convención que Leads: sobreviven a entrar a un lead y volver.
 */
export default function Consultas() {
  const { profile } = useAuth()
  const esDueno = profile?.rol === 'DUENO'
  const [searchParams, setSearchParams] = useSearchParams()

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

  return (
    <div className="mx-auto max-w-[880px]">
      <header className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.4rem] leading-tight font-bold text-ink">Consultas</h1>
          <p className="mt-0.5 text-[0.85rem] text-ink-3">
            Lo que llega por tu link de consultas. Aceptá las que valen la pena y pasan a Nuevos.
          </p>
        </div>

        {esDueno && agentes.length > 1 && (
          <label className="flex items-center gap-2 text-[0.82rem] text-ink-3 sm:ml-auto">
            Agente
            <select
              value={agenteId}
              onChange={(e) => escribir({ agente: e.target.value })}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.85rem] text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
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
          acción, pero el agente se tiene que enterar. Desaparecen solos. */}
      {filtro === 'pendientes' && page === 1 && (volvieron.data?.length ?? 0) > 0 && (
        <section className="mb-4 rounded-2xl border border-info/20 bg-cool-soft px-4 py-3">
          <h2 className="m-0 text-[0.88rem] font-bold text-info">Volvieron a consultar</h2>
          <p className="mt-0.5 mb-2 text-[0.78rem] text-ink-3">
            Ya eran leads; la consulta quedó en su ficha. Últimos {DIAS_VOLVIERON} días.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {volvieron.data!.map((v) => (
              // Texto corrido y no flex: cada "·" va pegado con &nbsp; a lo
              // anterior, así al cortar el renglón el separador queda al final
              // de una línea y nunca suelto al principio de la siguiente.
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
        <div aria-busy="true" aria-label="Cargando consultas" className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
          ))}
        </div>
      ) : lista.isError ? (
        <p role="alert" className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink">
          {lista.error instanceof Error ? lista.error.message : 'No se pudieron cargar las consultas.'}
        </p>
      ) : lista.data.consultas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <h2 className="m-0 text-[1rem] font-bold text-ink">{VACIO[filtro].titulo}</h2>
          <p className="mt-1.5 text-[0.88rem] text-ink-3">{VACIO[filtro].texto}</p>
        </div>
      ) : (
        <>
          {filtro === 'archivadas' && (
            <p className="mb-3 text-[0.82rem] text-ink-3">
              Pendientes con más de {DIAS_ARCHIVO} días. No cuentan en el número del menú, pero
              todavía las podés aceptar o descartar.
            </p>
          )}
          <div className={`flex flex-col gap-3 ${lista.isPlaceholderData ? 'opacity-60' : ''}`}>
            {lista.data.consultas.map((c) => (
              <TarjetaConsulta key={c.id} consulta={c} />
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="mt-4">
              <Paginacion page={page} totalPaginas={totalPaginas} onCambiar={(p) => escribir({ page: p })} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
