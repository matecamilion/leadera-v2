import { useMemo } from 'react'
import { DistribucionEstados } from '../components/admin/DistribucionEstados'
import { GraficoIngresos } from '../components/admin/GraficoIngresos'
import { GraficoPlanes } from '../components/admin/GraficoPlanes'
import { ListadoCuentas } from '../components/admin/ListadoCuentas'
import { RegistrosRecientes } from '../components/admin/RegistrosRecientes'
import { RequiereAccion } from '../components/admin/RequiereAccion'
import { CardKpi } from '../components/comunes/CardKpi'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { Spinner } from '../components/Spinner'
import { usePanelAdmin } from '../hooks/useAdmin'
import { usePreciosPlanes } from '../hooks/useSuscripcion'
import {
  contarPorEstado,
  contarPorPlan,
  cuentasPorVencer,
  formatearArs,
  graciaMercadoPago,
  ingresoUltimos30Dias,
  ingresosPorMes,
  mrrAPrecioDeLista,
  registrosRecientes,
  vencidasPorRecuperar,
} from '../lib/api/admin'

/**
 * Panel interno de LeadEra: cuentas y facturación de todas las inmobiliarias.
 * Sólo lectura. Llega acá únicamente el superadmin (AdminGuard + RLS).
 */
export default function Admin() {
  const panel = usePanelAdmin()
  const precios = usePreciosPlanes()

  const resumen = useMemo(() => {
    if (!panel.data) return null
    const ahora = new Date()
    const { cuentas, pagos } = panel.data
    const lista = precios.data ?? []

    // Todo lo que es una métrica mira sólo a los clientes: una cuenta interna
    // o de testing no es plata ni es un cliente, y contarla haría que los
    // números de esta pantalla no sirvan para decidir nada. `pagos` ya viene
    // filtrado de `obtenerPanelAdmin`.
    const clientes = cuentas.filter((c) => c.tipoCuenta === 'CLIENTE')
    const porVencer = cuentasPorVencer(clientes, ahora)
    const vencidas = vencidasPorRecuperar(clientes, pagos, lista, ahora)
    return {
      ahora,
      registros: registrosRecientes(cuentas, ahora),
      // El listado recibe todas: tiene su propio toggle.
      cuentas,
      totalClientes: clientes.length,
      porEstado: contarPorEstado(clientes),
      porPlan: contarPorPlan(clientes),
      ingreso30: ingresoUltimos30Dias(pagos, ahora),
      meses: ingresosPorMes(pagos, ahora),
      mrr: mrrAPrecioDeLista(clientes, lista),
      porVencer,
      porVencerTrial: porVencer.filter((p) => p.cuenta.estado === 'TRIAL').length,
      vencidas,
      vencidasMonto: vencidas.reduce((suma, v) => suma + (v.montoLista ?? 0), 0),
      gracia: graciaMercadoPago(clientes, ahora),
    }
  }, [panel.data, precios.data])

  if (panel.isPending) return <Spinner label="Cargando el panel" />

  if (panel.isError || !resumen) {
    return (
      <EstadoError
        mensaje={panel.error?.message ?? 'No se pudo cargar el panel.'}
        accion={<BotonError onClick={() => panel.refetch()}>Reintentar</BotonError>}
      />
    )
  }

  const { ingreso30, mrr } = resumen
  // Sin precios de lista no hay MRR ni monto a recuperar: se avisa en vez de
  // mostrar un $0 que parece un dato.
  const hayPrecios = precios.data !== undefined

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Cuentas y facturación</h1>
        <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">
          Todas las inmobiliarias de LeadEra. Sin datos de clientes: sólo cuentas, planes y pagos.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CardKpi
          label="Ingreso últimos 30 días"
          valor={formatearArs(ingreso30.total)}
          contexto={
            `${ingreso30.cantidadPagos} ${ingreso30.cantidadPagos === 1 ? 'pago aprobado' : 'pagos aprobados'}` +
            (ingreso30.enOtraMoneda > 0 ? ` · ${ingreso30.enOtraMoneda} en otra moneda, sin sumar` : '')
          }
        />
        <CardKpi
          label="MRR a precio de lista"
          valor={hayPrecios ? formatearArs(mrr.total) : '—'}
          contexto={
            hayPrecios
              ? `${mrr.contadas} ${mrr.contadas === 1 ? 'cuenta activa' : 'cuentas activas'}` +
                (mrr.sinPrecio > 0 ? ` · ${mrr.sinPrecio} sin precio` : '')
              : precios.isError
                ? 'No se pudieron cargar los precios'
                : 'Cargando precios'
          }
        />
        {/* Sólo ACTIVA: una cuenta en GRACIA no pagó su último cobro, y
            contarla acá inflaría el número. Tiene su propio grupo en
            "Requiere acción". */}
        <CardKpi
          label="Cuentas pagando"
          valor={String(resumen.porEstado.ACTIVA)}
          contexto={`de ${resumen.totalClientes} cuentas`}
        />
        <CardKpi
          label="Vencen en 7 días"
          valor={String(resumen.porVencer.length)}
          contexto={`${resumen.porVencerTrial} en prueba · ${resumen.porVencer.length - resumen.porVencerTrial} manuales`}
        />
        <CardKpi
          label="Vencidas por recuperar"
          valor={String(resumen.vencidas.length)}
          alerta={resumen.vencidas.length > 0}
          contexto={
            resumen.vencidas.length === 0
              ? 'Ninguna'
              : hayPrecios
                ? `${formatearArs(resumen.vencidasMonto)} por mes a precio de lista`
                : 'Ya pagaron antes'
          }
        />
      </div>

      <RequiereAccion vencidas={resumen.vencidas} porVencer={resumen.porVencer} gracia={resumen.gracia} />

      <ListadoCuentas cuentas={resumen.cuentas} />

      <RegistrosRecientes registros={resumen.registros} ahora={resumen.ahora} />

      <DistribucionEstados conteo={resumen.porEstado} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <GraficoIngresos meses={resumen.meses} />
        <GraficoPlanes conteo={resumen.porPlan} />
      </div>
    </div>
  )
}
