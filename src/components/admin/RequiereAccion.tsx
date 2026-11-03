import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  esSuspendida,
  formatearArs,
  formatearFechaAR,
  textoVencidaHace,
  type CuentaAdmin,
  type CuentaPorVencer,
  type GraciaMercadoPago,
  type VencidaPorRecuperar,
} from '../../lib/api/admin'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'

/** Filas que se ven antes de "Ver las demás". */
const FILAS_VISIBLES = 5

type Tono = 'rojo' | 'ambar'

/**
 * Clases literales para que Tailwind las encuentre. Rojo es plata que ya se
 * perdió; ámbar, plata que está por perderse.
 */
const TONOS: Record<Tono, { caja: string; titulo: string; estado: string; punto: string }> = {
  rojo: {
    caja: 'border-peligro-borde bg-peligro-soft',
    titulo: 'text-peligro-ink',
    estado: 'text-peligro-ink',
    punto: 'bg-peligro',
  },
  ambar: {
    caja: 'border-tibio/40 bg-warm-soft',
    titulo: 'text-badge-tibio-ink',
    estado: 'text-badge-tibio-ink',
    punto: 'bg-tibio',
  },
}

/** Cuántas columnas ocupan los grupos que tienen algo, en pantallas anchas. */
const COLUMNAS: Record<number, string> = {
  1: '',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
}

interface Fila {
  id: string
  nombre: string
  /** Segunda línea: plan, monto o fecha. */
  detalle: string
  /** Lo que hay que mirar de la cuenta: cuánto hace o cuánto falta. */
  estado: string
}

function nombreDelPlan(cuenta: CuentaAdmin): string {
  return cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'Sin plan'
}

function filaVencida({ cuenta, montoLista, diasVencida }: VencidaPorRecuperar): Fila {
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    detalle: `${nombreDelPlan(cuenta)} · ${
      montoLista === null ? 'sin precio de lista' : `${formatearArs(montoLista)} por mes`
    }`,
    estado: esSuspendida(cuenta)
      ? 'Suspendida'
      : diasVencida === null
        ? 'Vencida'
        : `Vencida ${textoVencidaHace(diasVencida)}`,
  }
}

function textoPorVencer(dias: number): string {
  if (dias < 0) return 'Ya venció'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

function filaPorVencer({ cuenta, fecha, dias }: CuentaPorVencer): Fila {
  const etiqueta = cuenta.estado === 'TRIAL' ? 'Fin de la prueba' : 'Vence'
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    detalle: `${nombreDelPlan(cuenta)} · ${etiqueta} ${formatearFechaAR(fecha)}`,
    estado: textoPorVencer(dias),
  }
}

function filaGracia({ cuenta, diasDesdeFallo }: GraciaMercadoPago): Fila {
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    detalle: `${nombreDelPlan(cuenta)}${cuenta.cancelacionSolicitada ? ' · Pidió cancelar' : ''}`,
    estado:
      diasDesdeFallo === null
        ? 'Falló el cobro'
        : `Falló el cobro ${textoVencidaHace(diasDesdeFallo)}`,
  }
}

/**
 * Lo que hay que cobrar o seguir hoy, antes que cualquier otra cosa del panel.
 *
 * Tres grupos —vencidas por recuperar, vencen en 7 días y Mercado Pago en
 * gracia— y sólo se muestran los que tienen cuentas. Cada fila es un link al
 * detalle. Las filas se apilan en lugar de formar una tabla: en el celular no
 * hay scroll horizontal.
 */
export function RequiereAccion({
  vencidas,
  porVencer,
  gracia,
}: {
  vencidas: VencidaPorRecuperar[]
  porVencer: CuentaPorVencer[]
  gracia: GraciaMercadoPago[]
}) {
  const grupos = [
    {
      id: 'vencidas',
      titulo: 'Vencidas por recuperar',
      descripcion: 'Ya pagaron antes y hoy no tienen acceso.',
      tono: 'rojo' as const,
      filas: vencidas.map(filaVencida),
    },
    {
      id: 'por-vencer',
      titulo: 'Vencen en 7 días',
      descripcion: 'Pruebas y cuentas manuales.',
      tono: 'ambar' as const,
      filas: porVencer.map(filaPorVencer),
    },
    {
      id: 'gracia',
      titulo: 'Mercado Pago en gracia',
      descripcion: 'El último cobro falló. Si no se regulariza, pierden el acceso.',
      tono: 'ambar' as const,
      filas: gracia.map(filaGracia),
    },
  ].filter((g) => g.filas.length > 0)

  const total = grupos.reduce((suma, g) => suma + g.filas.length, 0)

  return (
    <section
      aria-labelledby="titulo-accion"
      className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-accion" className="m-0 text-titulo font-bold text-ink">
          Requiere acción
        </h2>
        {total > 0 && (
          <span className="text-meta text-ink-3 tabular-nums">
            {total === 1 ? '1 cuenta' : `${total} cuentas`}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 mb-0 rounded-xl border border-border bg-surface-2 px-4 py-6 text-center text-cuerpo font-semibold text-ink-2">
          Todo al día
        </p>
      ) : (
        <div className={`mt-4 grid gap-4 ${COLUMNAS[grupos.length]}`}>
          {grupos.map((g) => (
            <Grupo key={g.id} id={g.id} titulo={g.titulo} descripcion={g.descripcion} tono={g.tono} filas={g.filas} />
          ))}
        </div>
      )}
    </section>
  )
}

function Grupo({
  id,
  titulo,
  descripcion,
  tono,
  filas,
}: {
  id: string
  titulo: string
  descripcion: string
  tono: Tono
  filas: Fila[]
}) {
  const [todas, setTodas] = useState(false)
  const clases = TONOS[tono]
  const visibles = todas ? filas : filas.slice(0, FILAS_VISIBLES)
  const restantes = filas.length - FILAS_VISIBLES

  return (
    <section aria-labelledby={`titulo-accion-${id}`} className={`min-w-0 rounded-xl border p-3.5 ${clases.caja}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${clases.punto}`} />
        <h3 id={`titulo-accion-${id}`} className={`m-0 text-cuerpo font-bold ${clases.titulo}`}>
          {titulo}
        </h3>
        <span className={`ml-auto text-cuerpo font-bold tabular-nums ${clases.titulo}`}>{filas.length}</span>
      </div>
      <p className="mt-1 mb-3 text-meta text-ink-2">{descripcion}</p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {visibles.map((f) => (
          <li key={f.id}>
            <Link
              to={`/admin/inmobiliarias/${f.id}`}
              className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-ink-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <span className="min-w-0 text-cuerpo font-semibold break-words text-ink">{f.nombre}</span>
              <span className="min-w-0 text-meta break-words text-ink-3">{f.detalle}</span>
              <span className={`text-meta font-semibold ${clases.estado}`}>{f.estado}</span>
            </Link>
          </li>
        ))}
      </ul>

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          aria-expanded={todas}
          className="mt-2 w-full rounded-lg px-3 py-2 text-meta font-semibold text-ink-2 transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {todas ? 'Ver menos' : `Ver las ${restantes} restantes`}
        </button>
      )}
    </section>
  )
}
