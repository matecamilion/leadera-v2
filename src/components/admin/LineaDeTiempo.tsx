import { useState, type ReactNode } from 'react'
import { BotonError, EstadoError } from '../comunes/EstadoError'
import { Spinner } from '../Spinner'
import { useAnularPago } from '../../hooks/useAdmin'
import {
  formatearArs,
  formatearFechaAR,
  idsAnulados,
  type EventoCuenta,
} from '../../lib/api/admin'
import { ModalAccionConNota } from './ModalAccionConNota'

/** Eventos que se ven antes de "Ver más". */
const EVENTOS_VISIBLES = 8

type Tono = 'verde' | 'rojo' | 'ambar' | 'azul' | 'neutro' | 'marca'

/** Clases literales para que Tailwind las encuentre. */
const TONOS: Record<Tono, string> = {
  verde: 'bg-badge-ganado-bg text-success',
  rojo: 'bg-peligro-soft text-peligro-ink',
  ambar: 'bg-warm-soft text-badge-tibio-ink',
  azul: 'bg-cool-soft text-info',
  neutro: 'bg-surface-2 text-ink-3',
  marca: 'bg-brand-soft text-primary',
}

/** Trazos de 24×24, uno por tipo de cosa que le puede pasar a una cuenta. */
const ICONOS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  alerta: 'M12 7v6M12 17h.01',
  prohibido: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  calendario: 'M4 7h16v13H4zM4 11h16M9 3v4M15 3v4',
  pausa: 'M10 8v8M14 8v8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  etiqueta: 'M4 4h7l9 9-7 7-9-9zM8 8h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8v.01',
  bandera: 'M5 21V4M5 4h11l-2 4 2 4H5',
  reanudar: 'M8 5l11 7-11 7zM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  puntos: 'M6 12h.01M12 12h.01M18 12h.01',
} as const

type Icono = keyof typeof ICONOS

interface Estilo {
  icono: Icono
  tono: Tono
}

const ESTILO_POR_TIPO: Record<string, Estilo> = {
  pago_aprobado: { icono: 'check', tono: 'verde' },
  pago_manual: { icono: 'check', tono: 'verde' },
  pago_anulado: { icono: 'x', tono: 'rojo' },
  pago_rechazado: { icono: 'alerta', tono: 'rojo' },
  suscripcion_cancelada: { icono: 'prohibido', tono: 'ambar' },
  cancelacion_solicitada: { icono: 'prohibido', tono: 'ambar' },
  trial_extendido: { icono: 'reloj', tono: 'azul' },
  ajuste_vencimiento: { icono: 'calendario', tono: 'azul' },
  cuenta_suspendida: { icono: 'pausa', tono: 'rojo' },
  cuenta_vencida_manual: { icono: 'alerta', tono: 'ambar' },
  cuenta_reactivada: { icono: 'reanudar', tono: 'verde' },
  tipo_cuenta_cambiado: { icono: 'etiqueta', tono: 'neutro' },
  webhook_ignorado_cuenta_manual: { icono: 'info', tono: 'neutro' },
}

const ESTILO_POR_DEFECTO: Estilo = { icono: 'info', tono: 'neutro' }

/** Los tipos cuyo monto es plata que entró. */
const TIPOS_CON_SIGNO = ['pago_aprobado', 'pago_manual']
/** Los tipos que muestran un monto, con o sin signo. Una anulación no: el monto ya está en el pago. */
const TIPOS_CON_MONTO = [...TIPOS_CON_SIGNO, 'pago_rechazado']

function montoComoTexto(e: EventoCuenta): string {
  const monto = e.monto ?? 0
  return e.moneda === 'ARS' ? formatearArs(monto) : `${monto.toLocaleString('es-AR')} ${e.moneda}`
}

function Nodo({ icono, tono }: Estilo) {
  return (
    <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full ${TONOS[tono]}`}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ICONOS[icono]} />
      </svg>
    </span>
  )
}

/** Un ítem de la línea: el nodo con su ícono, el hilo que lo une con el siguiente y el contenido. */
function Item({ estilo, ultimo, children }: { estilo: Estilo; ultimo: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <Nodo {...estilo} />
        {!ultimo && <span aria-hidden className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={`min-w-0 flex-1 ${ultimo ? '' : 'pb-4'}`}>{children}</div>
    </li>
  )
}

/**
 * Todo lo que le pasó a la cuenta en cuanto a cobros, del más reciente al más
 * viejo, y el alta al final como punto de partida.
 *
 * Un pago anulado se ve tachado y con su etiqueta. Los pagos manuales vigentes
 * se pueden anular desde acá.
 */
export function LineaDeTiempo({
  nombre,
  creadaEl,
  eventos,
  cargando,
  error,
  onReintentar,
}: {
  nombre: string
  creadaEl: string
  eventos: EventoCuenta[] | undefined
  cargando: boolean
  error: string | null
  onReintentar: () => void
}) {
  const anular = useAnularPago()
  const [verTodos, setVerTodos] = useState(false)
  const [pagoAAnular, setPagoAAnular] = useState<EventoCuenta | null>(null)

  const anulados = eventos ? idsAnulados(eventos) : new Set<string>()
  const visibles = eventos && !verTodos ? eventos.slice(0, EVENTOS_VISIBLES) : (eventos ?? [])
  const ocultos = eventos ? eventos.length - visibles.length : 0

  return (
    <section
      aria-labelledby="titulo-linea"
      className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id="titulo-linea" className="m-0 text-titulo font-bold text-ink">
        Historial de cobros
      </h2>

      {cargando && (
        <div className="mt-4">
          <Spinner label="Cargando el historial" />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <EstadoError mensaje={error} accion={<BotonError onClick={onReintentar}>Reintentar</BotonError>} />
        </div>
      )}

      {eventos && (
        <>
          {eventos.length === 0 && (
            <p className="mt-1 mb-0 text-meta text-ink-3">Todavía no hay movimientos de cobro.</p>
          )}

          <ol className="m-0 mt-4 list-none p-0">
            {visibles.map((e) => {
              const estilo = ESTILO_POR_TIPO[e.tipo] ?? ESTILO_POR_DEFECTO
              const anulado = anulados.has(e.id)
              const anulable = e.tipo === 'pago_manual' && !anulado
              const tachado = anulado ? 'text-ink-3 line-through' : ''

              return (
                <Item key={e.id} estilo={estilo} ultimo={false}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={`text-cuerpo font-semibold text-ink ${tachado}`}>{e.etiqueta}</span>
                    {anulado && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-meta font-bold text-ink-3 uppercase">
                        Anulado
                      </span>
                    )}
                    {e.monto !== null && TIPOS_CON_MONTO.includes(e.tipo) && (
                      <span
                        className={`text-cuerpo font-semibold tabular-nums ${
                          anulado
                            ? 'text-ink-3 line-through'
                            : TIPOS_CON_SIGNO.includes(e.tipo)
                              ? 'text-success'
                              : 'text-ink-3'
                        }`}
                      >
                        {TIPOS_CON_SIGNO.includes(e.tipo) ? '+ ' : ''}
                        {montoComoTexto(e)}
                      </span>
                    )}
                    <span className="ml-auto text-meta text-ink-3 tabular-nums">
                      {formatearFechaAR(e.fecha)}
                    </span>
                  </div>

                  {e.detalle && (
                    <p className={`m-0 mt-0.5 text-meta break-words text-ink-3 ${anulado ? 'line-through' : ''}`}>
                      {e.detalle}
                    </p>
                  )}

                  {anulable && (
                    <button
                      type="button"
                      onClick={() => {
                        anular.reset()
                        setPagoAAnular(e)
                      }}
                      className="mt-2 rounded-md border border-peligro-borde bg-surface px-2.5 py-1 text-meta font-semibold text-peligro-ink transition-colors hover:bg-peligro-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none"
                    >
                      Anular pago
                    </button>
                  )}
                </Item>
              )
            })}

            {(ocultos > 0 || verTodos) && eventos.length > EVENTOS_VISIBLES && (
              <Item estilo={{ icono: 'puntos', tono: 'neutro' }} ultimo={false}>
                <button
                  type="button"
                  onClick={() => setVerTodos((v) => !v)}
                  aria-expanded={verTodos}
                  className="rounded-md px-2 py-1.5 text-cuerpo font-semibold text-primary transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {verTodos ? 'Ver menos' : `Ver ${ocultos} ${ocultos === 1 ? 'más' : 'más antiguos'}`}
                </button>
              </Item>
            )}

            <Item estilo={{ icono: 'bandera', tono: 'marca' }} ultimo>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-cuerpo font-semibold text-ink">Alta de la cuenta</span>
                <span className="ml-auto text-meta text-ink-3 tabular-nums">{formatearFechaAR(creadaEl)}</span>
              </div>
            </Item>
          </ol>
        </>
      )}

      <ModalAccionConNota
        abierto={pagoAAnular !== null}
        titulo="Anular el pago"
        subtitulo={nombre}
        descripcion={
          pagoAAnular
            ? `Se le van a descontar a la cuenta los meses que cubría este pago de ${
                pagoAAnular.monto === null ? 'monto desconocido' : formatearArs(pagoAAnular.monto)
              }. El pago queda en el historial, tachado.`
            : undefined
        }
        placeholderNota="Por qué se anula: se cargó mal, la transferencia no entró…"
        textoConfirmar="Anular pago"
        textoConfirmando="Anulando…"
        destructivo
        guardando={anular.isPending}
        error={anular.isError ? anular.error.message : null}
        onCerrar={() => {
          if (anular.isPending) return
          setPagoAAnular(null)
        }}
        onConfirmar={(nota) => {
          if (!pagoAAnular) return
          anular.mutate({ eventoId: pagoAAnular.id, nota }, { onSuccess: () => setPagoAAnular(null) })
        }}
      />
    </section>
  )
}
