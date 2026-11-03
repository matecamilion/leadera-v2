import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AccionesCuenta } from '../components/admin/AccionesCuenta'
import { BloqueoVigente } from '../components/admin/BloqueoVigente'
import { CabeceraCuenta } from '../components/admin/CabeceraCuenta'
import { LineaDeTiempo } from '../components/admin/LineaDeTiempo'
import { ResumenDeCobrosCuenta } from '../components/admin/ResumenDeCobrosCuenta'
import { UsoDeLaCuenta } from '../components/admin/UsoDeLaCuenta'
import { ZonaDeCuenta } from '../components/admin/ZonaDeCuenta'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { Spinner } from '../components/Spinner'
import { useHistorialCobros, useMetricasCuenta, usePanelAdmin } from '../hooks/useAdmin'
import { usePreciosPlanes } from '../hooks/useSuscripcion'
import { resumenDeCobros } from '../lib/api/admin'

/**
 * Ficha de una inmobiliaria en el panel interno: quién es el cliente, cuánto
 * pagó, qué uso hace y qué se puede hacer con la cuenta.
 *
 * Los datos de cuenta salen de la misma consulta que el listado —ya está en
 * cache si se llega con un click, y son pocas filas si se entra por link—, así
 * que la cabecera dice exactamente lo mismo que la fila de la tabla.
 *
 * El uso sale de `admin_metricas_inmobiliaria`: conteos, nunca filas. Esta
 * pantalla no tiene forma de mostrar un lead, una propiedad ni el texto de una
 * interacción, porque la base no se los devuelve.
 */
export default function AdminDetalleCuenta() {
  const { id } = useParams<{ id: string }>()
  const panel = usePanelAdmin()
  const metricas = useMetricasCuenta(id)
  const cobros = useHistorialCobros(id)
  const precios = usePreciosPlanes()
  const navigate = useNavigate()
  const location = useLocation()

  // Si se llegó a la ficha desde el listado, "volver" retrocede en el historial
  // y así conserva búsqueda, filtros y orden (que viven en la URL). La entrada
  // inicial de la sesión tiene `key === 'default'`: se abrió la ficha directo
  // por URL, no hay listado al que volver, y el link a /admin hace de respaldo.
  function volverAlListado(e: MouseEvent<HTMLAnchorElement>) {
    if (location.key === 'default') return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(-1)
  }

  const volver = (
    <Link
      to="/admin"
      onClick={volverAlListado}
      className="inline-flex items-center gap-1 text-cuerpo font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span aria-hidden>←</span> Todas las inmobiliarias
    </Link>
  )

  if (panel.isPending) return <Spinner label="Cargando la cuenta" />

  if (panel.isError) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <EstadoError
          mensaje={panel.error.message}
          accion={<BotonError onClick={() => panel.refetch()}>Reintentar</BotonError>}
        />
      </div>
    )
  }

  const cuenta = panel.data.cuentas.find((c) => c.id === id)
  if (!cuenta) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <EstadoError
          titulo="No encontramos esa inmobiliaria"
          mensaje="Puede que el link esté mal o que la cuenta ya no exista."
        />
      </div>
    )
  }

  const ahora = new Date()
  const precioLista = cuenta.plan
    ? (precios.data?.find((p) => p.plan === cuenta.plan)?.precio_ars ?? null)
    : null
  const resumen = cobros.data ? resumenDeCobros(cobros.data, cuenta.creadaEl) : null

  return (
    <div className="flex flex-col gap-5">
      {volver}

      <CabeceraCuenta cuenta={cuenta} precioLista={precioLista} ahora={ahora} />

      <BloqueoVigente cuenta={cuenta} ahora={ahora} />

      <AccionesCuenta cuenta={cuenta} precios={precios.data} />

      {resumen && <ResumenDeCobrosCuenta resumen={resumen} estado={cuenta.estado} ahora={ahora} />}

      <LineaDeTiempo
        nombre={cuenta.nombre}
        creadaEl={cuenta.creadaEl}
        eventos={cobros.data}
        cargando={cobros.isPending}
        error={cobros.isError ? cobros.error.message : null}
        onReintentar={() => cobros.refetch()}
      />

      <UsoDeLaCuenta
        metricas={metricas.data}
        limiteUsuarios={cuenta.limiteUsuarios}
        cargando={metricas.isPending}
        error={metricas.isError ? metricas.error.message : null}
        onReintentar={() => metricas.refetch()}
        ahora={ahora}
      />

      <ZonaDeCuenta cuenta={cuenta} />
    </div>
  )
}
