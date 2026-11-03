import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  contarPorEstadoVisible,
  FILTROS_VACIOS,
  filtrarCuentas,
  filtrosDesdeUrl,
  ordenarCuentas,
  urlDesdeFiltros,
  type CriterioOrden,
  type CuentaAdmin,
  type FiltrosCuentas,
} from '../../lib/api/admin'
import { BarraDeFiltrosCuentas } from './BarraDeFiltrosCuentas'
import { TablaCuentas } from './TablaCuentas'
import { TarjetasCuentas } from './TarjetasCuentas'

/**
 * Las inmobiliarias de LeadEra como herramienta de trabajo: se buscan, se
 * filtran y se ordenan. La tabla es para `md` en adelante; en el celular, tarjetas.
 *
 * Búsqueda, filtros y orden viven en la URL (?q, ?estado, ?plan, ?metodo,
 * ?internas, ?orden) y no en el estado del componente: así sobreviven a entrar
 * a una ficha y volver con el botón "atrás". Se escriben con `replace`, para
 * que cada tecla o cada chip no sea un paso más del historial.
 *
 * Por defecto se listan sólo las cuentas CLIENTE, que son las que importan para
 * decidir algo. Las internas y de testing están detrás de un toggle: no se
 * ocultan del todo —hay que poder entrar a su detalle— pero tampoco compiten
 * con los clientes en la lista que se mira todos los días.
 */
export function ListadoCuentas({ cuentas }: { cuentas: CuentaAdmin[] }) {
  const [params, setParams] = useSearchParams()
  const { filtros, orden } = useMemo(() => filtrosDesdeUrl(params), [params])
  const ahora = new Date()

  function cambiar(cambios: Partial<FiltrosCuentas>, nuevoOrden: CriterioOrden = orden) {
    setParams(urlDesdeFiltros({ ...filtros, ...cambios }, nuevoOrden), { replace: true })
  }

  function limpiar() {
    setParams(urlDesdeFiltros(FILTROS_VACIOS, orden), { replace: true })
  }

  const noClientes = cuentas.filter((c) => c.tipoCuenta !== 'CLIENTE').length
  // El "M" de "N de M cuentas": las que hay antes de buscar, filtrar o elegir estados.
  const total = filtrarCuentas(cuentas, { ...FILTROS_VACIOS, incluirInternas: filtros.incluirInternas }).length
  // Los contadores de los chips ignoran los estados elegidos: si no, al marcar
  // uno todos los demás dirían cero y no se podría sumar un segundo.
  const conteos = contarPorEstadoVisible(filtrarCuentas(cuentas, { ...filtros, estados: [] }))
  const resultados = ordenarCuentas(filtrarCuentas(cuentas, filtros), orden, ahora)

  return (
    <section aria-labelledby="titulo-cuentas" className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:px-5">
        <h2 id="titulo-cuentas" className="m-0 text-titulo font-bold text-ink">
          Inmobiliarias
        </h2>

        <BarraDeFiltrosCuentas
          filtros={filtros}
          orden={orden}
          conteos={conteos}
          noClientes={noClientes}
          resultados={resultados.length}
          total={total}
          onCambiar={(cambios) => cambiar(cambios)}
          onOrden={(nuevo) => cambiar({}, nuevo)}
          onLimpiar={limpiar}
        />
      </div>

      {resultados.length === 0 ? (
        <div className="border-t border-border px-4 py-8 text-center sm:px-5">
          <p className="m-0 text-cuerpo font-semibold text-ink">
            {total === 0 ? 'Todavía no hay cuentas.' : 'Ninguna cuenta coincide con estos filtros.'}
          </p>
          {total > 0 && (
            <button
              type="button"
              onClick={limpiar}
              className="mt-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-cuerpo font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <TablaCuentas cuentas={resultados} ahora={ahora} />
          </div>
          <div className="border-t border-border md:hidden">
            <TarjetasCuentas cuentas={resultados} ahora={ahora} />
          </div>
        </>
      )}
    </section>
  )
}
