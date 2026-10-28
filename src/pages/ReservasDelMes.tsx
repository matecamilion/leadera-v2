import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SelectorMes } from '../components/comunes/SelectorMes'
import { ModalCargarReserva } from '../components/dashboard/ModalCargarReserva'
import { ReservasCards } from '../components/operaciones/ReservasCards'
import { ReservasTabla } from '../components/operaciones/ReservasTabla'
import { useReservasDeMes } from '../hooks/useOperaciones'
import {
  puntaDeTipo,
  RESERVAS_MAX_POR_MES,
  type PuntaReserva,
} from '../lib/api/operaciones'
import { mensajeDeListado } from '../lib/mensajesDeError'
import { leerMes, mesDeFecha, nombreDelMes } from '../lib/mes'
import { hoyEnArgentina } from '../lib/ritmoSemanal'

/** `?punta=` saneado: cualquier otra cosa es "todas". */
function leerPunta(valor: string | null): PuntaReserva | undefined {
  return valor === 'vendedora' || valor === 'compradora' ? valor : undefined
}

const BOTON_CARGAR =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark motion-reduce:transition-none'

export default function ReservasDelMes() {
  // Mes y punta viven en la URL, como los filtros del listado: sobreviven a
  // entrar a una operación y volver, y se pueden pasar por chat.
  const [searchParams, setSearchParams] = useSearchParams()
  const mesActual = mesDeFecha(hoyEnArgentina())
  const mes = leerMes(searchParams.get('mes'), mesActual)
  const punta = leerPunta(searchParams.get('punta'))

  const [cargando, setCargando] = useState(false)
  const { data, isPending, isError, error } = useReservasDeMes(mes)

  /** Lo que está en su valor por defecto no se escribe. Con `replace`, como el listado. */
  function escribir(nuevoMes: string, nuevaPunta: PuntaReserva | undefined) {
    setSearchParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)
        if (nuevoMes !== mesActual) proximos.set('mes', nuevoMes)
        else proximos.delete('mes')
        if (nuevaPunta) proximos.set('punta', nuevaPunta)
        else proximos.delete('punta')
        return proximos
      },
      { replace: true },
    )
  }

  const reservas = data?.data ?? []
  const vendedoras = reservas.filter((r) => puntaDeTipo(r.tipo) === 'vendedora').length
  const visibles = punta ? reservas.filter((r) => puntaDeTipo(r.tipo) === punta) : reservas
  const conAgente = new Set(reservas.map((r) => r.agente_id)).size > 1

  const opciones: { valor: PuntaReserva | undefined; label: string }[] = [
    { valor: undefined, label: `Todas (${reservas.length})` },
    { valor: 'vendedora', label: `Vendedora (${vendedoras})` },
    { valor: 'compradora', label: `Compradora (${reservas.length - vendedoras})` },
  ]

  const anoDelMes = mes.slice(0, 4)
  const titulo = `Reservas de ${nombreDelMes(mes, anoDelMes !== mesActual.slice(0, 4))}`

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Operaciones
          </p>
          <h1 className="m-0 text-[1.6rem] font-bold text-ink">{titulo}</h1>
          <p className="mt-1 text-[0.92rem] text-ink-3">
            Operaciones que pasaron a Reservada en el mes, aunque hoy estén en otro estado.
          </p>
        </div>

        <button type="button" onClick={() => setCargando(true)} className={BOTON_CARGAR}>
          Cargar reserva
        </button>
      </header>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SelectorMes mes={mes} onCambiar={(m) => escribir(m, punta)} tope={mesActual} />

        <div
          role="group"
          aria-label="Filtrar por punta"
          className="flex rounded-full border border-border bg-surface p-0.5 md:inline-flex"
        >
          {opciones.map((o) => {
            const activo = o.valor === punta
            return (
              <button
                key={o.valor ?? 'todas'}
                type="button"
                aria-pressed={activo}
                onClick={() => escribir(mes, o.valor)}
                className={[
                  'min-h-10 flex-1 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap md:flex-none',
                  'transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  activo ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-background hover:text-ink',
                ].join(' ')}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {mensajeDeListado(error)}
        </p>
      ) : reservas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
          <h3 className="mb-1.5 font-semibold text-ink-2">No hay reservas en este mes</h3>
          <button type="button" onClick={() => setCargando(true)} className={`${BOTON_CARGAR} mt-3`}>
            Cargar reserva
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
          <h3 className="mb-1.5 font-semibold text-ink-2">Sin reservas de esta punta</h3>
          <p className="text-[0.9rem]">Probá con otra opción del filtro.</p>
        </div>
      ) : (
        <>
          {data.count > RESERVAS_MAX_POR_MES && (
            <p className="mb-3 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[0.85rem] text-ink-3">
              Mostrando las {RESERVAS_MAX_POR_MES} más recientes.
            </p>
          )}
          <div className="hidden md:block">
            <ReservasTabla reservas={visibles} conAgente={conAgente} />
          </div>
          <div className="md:hidden">
            <ReservasCards reservas={visibles} conAgente={conAgente} />
          </div>
        </>
      )}

      {cargando && <ModalCargarReserva onCerrar={() => setCargando(false)} />}
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando reservas"
      className="space-y-3 md:space-y-0 md:rounded-xl md:border md:border-border md:bg-surface md:p-3"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-surface-2 md:h-12 md:rounded-md motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
