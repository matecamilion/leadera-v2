import { useMemo } from 'react'
import { AlertaGracia } from '../components/admin/AlertaGracia'
import { DistribucionEstados } from '../components/admin/DistribucionEstados'
import { GraficoIngresos } from '../components/admin/GraficoIngresos'
import { GraficoPlanes } from '../components/admin/GraficoPlanes'
import { TablaCuentas } from '../components/admin/TablaCuentas'
import { CardKpi } from '../components/comunes/CardKpi'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { Spinner } from '../components/Spinner'
import { usePanelAdmin } from '../hooks/useAdmin'
import {
  contarPorEstado,
  contarPorPlan,
  estaPorVencer,
  formatearArs,
  ingresoUltimos30Dias,
  ingresosPorMes,
  ordenarCuentas,
} from '../lib/api/admin'

/**
 * Panel interno de LeadEra: cuentas y facturación de todas las inmobiliarias.
 * Sólo lectura. Llega acá únicamente el superadmin (AdminGuard + RLS).
 */
export default function Admin() {
  const panel = usePanelAdmin()

  const resumen = useMemo(() => {
    if (!panel.data) return null
    const ahora = new Date()
    const { cuentas, pagos } = panel.data
    const porVencer = cuentas.filter((c) => estaPorVencer(c, ahora))
    return {
      cuentas: ordenarCuentas(cuentas),
      enGracia: ordenarCuentas(cuentas.filter((c) => c.estado === 'GRACIA')),
      porEstado: contarPorEstado(cuentas),
      porPlan: contarPorPlan(cuentas),
      ingreso30: ingresoUltimos30Dias(pagos, ahora),
      meses: ingresosPorMes(pagos, ahora),
      porVencerTrial: porVencer.filter((c) => c.estado === 'TRIAL').length,
      porVencerGracia: porVencer.filter((c) => c.estado === 'GRACIA').length,
      porVencer: porVencer.length,
    }
  }, [panel.data])

  if (panel.isPending) return <Spinner label="Cargando el panel" />

  if (panel.isError || !resumen) {
    return (
      <EstadoError
        mensaje={panel.error?.message ?? 'No se pudo cargar el panel.'}
        accion={<BotonError onClick={() => panel.refetch()}>Reintentar</BotonError>}
      />
    )
  }

  const { ingreso30 } = resumen

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Cuentas y facturación</h1>
        <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">
          Todas las inmobiliarias de LeadEra. Sin datos de clientes: sólo cuentas, planes y pagos.
        </p>
      </header>

      {resumen.enGracia.length > 0 && <AlertaGracia cuentas={resumen.enGracia} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <CardKpi
          label="Ingreso últimos 30 días"
          valor={formatearArs(ingreso30.total)}
          contexto={
            `${ingreso30.cantidadPagos} ${ingreso30.cantidadPagos === 1 ? 'pago aprobado' : 'pagos aprobados'}` +
            (ingreso30.enOtraMoneda > 0 ? ` · ${ingreso30.enOtraMoneda} en otra moneda, sin sumar` : '')
          }
        />
        <CardKpi
          label="Por vencer esta semana"
          valor={String(resumen.porVencer)}
          contexto={`${resumen.porVencerTrial} trial · ${resumen.porVencerGracia} en gracia`}
          tono={resumen.porVencer > 0 ? 'caliente' : 'neutro'}
        />
        {/* Sólo ACTIVA: una cuenta en GRACIA no pagó su último cobro, y
            contarla acá inflaría el número. Tiene su propia alerta arriba. */}
        <CardKpi
          label="Cuentas pagando"
          valor={String(resumen.porEstado.ACTIVA)}
          contexto={`de ${resumen.cuentas.length} cuentas`}
        />
      </div>

      <DistribucionEstados conteo={resumen.porEstado} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <GraficoIngresos meses={resumen.meses} />
        <GraficoPlanes conteo={resumen.porPlan} />
      </div>

      <TablaCuentas cuentas={resumen.cuentas} />
    </div>
  )
}
