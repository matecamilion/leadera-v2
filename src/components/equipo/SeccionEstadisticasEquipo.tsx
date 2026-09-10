import { CardKpi } from '../comunes/CardKpi'
import {
  IconoCheck,
  IconoConversacion,
  IconoFuego,
  IconoPersonaMas,
  IconoTermometro,
} from '../leads/Iconos'
import type { StatsEquipo } from '../../lib/api/equipo'

/** Porcentaje con un decimal, o '—' si todavía no se puede calcular. */
function tasa(valor: number | null): string {
  return valor == null ? '—' : `${valor.toFixed(1)}%`
}

export function SeccionEstadisticasEquipo({ stats }: { stats: StatsEquipo }) {
  const { totales, porAgente } = stats

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CardKpi
          label="Leads activos"
          valor={String(totales.activos)}
          contexto="De todo el equipo"
          icono={<IconoTermometro className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Calientes"
          valor={String(totales.calientes)}
          icono={<IconoFuego className="size-[18px]" />}
          tono="caliente"
        />
        <CardKpi
          label="Nuevos del mes"
          valor={String(totales.nuevosDelMes)}
          icono={<IconoPersonaMas className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Ganados del mes"
          valor={String(totales.ganadosMes)}
          icono={<IconoCheck className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Tasa de conversión"
          valor={tasa(totales.tasaConversion)}
          contexto="Ganados sobre contactados"
          icono={<IconoCheck className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Interacciones (7d)"
          valor={String(totales.interacciones7d)}
          icono={<IconoConversacion className="size-[18px]" />}
          tono="frio"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="m-0 mb-4 text-[0.95rem] font-bold text-ink">Desglose por agente</h3>

        {porAgente.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-[0.85rem] text-ink-3">
            Todavía no hay agentes con cartera.
          </p>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[0.85rem]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 pr-3 text-left text-xs font-semibold text-ink-3 uppercase">
                      Agente
                    </th>
                    {['Activos', 'Calientes', 'Nuevos (mes)', 'Ganados (mes)', 'Conversión', 'Interac. 7d'].map(
                      (h) => (
                        <th
                          key={h}
                          className="py-2.5 pr-3 text-right text-xs font-semibold text-ink-3 uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {porAgente.map((a) => (
                    <tr key={a.agenteId} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-ink">{a.nombre}</td>
                      <Num>{a.activos}</Num>
                      <Num>{a.calientes}</Num>
                      <Num>{a.nuevosDelMes}</Num>
                      <Num>{a.ganadosMes}</Num>
                      <Num>{tasa(a.tasaConversion)}</Num>
                      <Num>{a.interacciones7d}</Num>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: una card por agente */}
            <ul className="flex flex-col gap-3 md:hidden">
              {porAgente.map((a) => (
                <li key={a.agenteId} className="rounded-xl border border-border p-3.5">
                  <p className="m-0 mb-2 font-semibold text-ink">{a.nombre}</p>
                  <dl className="grid grid-cols-3 gap-2 text-[0.78rem]">
                    <Dato label="Activos" valor={a.activos} />
                    <Dato label="Calientes" valor={a.calientes} />
                    <Dato label="Nuevos" valor={a.nuevosDelMes} />
                    <Dato label="Ganados" valor={a.ganadosMes} />
                    <Dato label="Conversión" valor={tasa(a.tasaConversion)} />
                    <Dato label="Interac. 7d" valor={a.interacciones7d} />
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-2.5 pr-3 text-right text-ink-2 tabular-nums">{children}</td>
  )
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold text-ink-3 uppercase">{label}</dt>
      <dd className="m-0 mt-0.5 font-semibold text-ink tabular-nums">{valor}</dd>
    </div>
  )
}
