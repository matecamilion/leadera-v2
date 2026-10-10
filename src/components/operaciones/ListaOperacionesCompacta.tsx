import {
  etiquetaEstadoOperacion,
  etiquetaTipoOperacion,
  formatearMonto,
  type OperacionListada,
} from '../../lib/api/operaciones'
import { diasSinMovimiento, esOperacionTrabada } from '../../lib/kanbanUtils'
import { formatearFecha } from '../../lib/formatoFecha'
import { FilaLista, ListaFilas } from '../ui/FilaLista'

interface Props {
  operaciones: OperacionListada[]
  cargando: boolean
  error?: string | null
  /** Qué decir cuando no hay ninguna. */
  textoVacio: string
}

/**
 * Operaciones como filas de lista (ver FilaLista).
 *
 * La usan la tab del lead y la sección de la propiedad, donde ya se conoce el
 * contexto. El monto es el dato principal; si falta, un "Cargar monto"
 * discreto invita a completarlo. El aviso de "sin mover" sólo aparece pasado
 * el umbral de trabada (DIAS_PARA_TRABADA, en kanbanUtils).
 */
export function ListaOperacionesCompacta({
  operaciones,
  cargando,
  error,
  textoVacio,
}: Props) {
  if (cargando) {
    return (
      <div aria-busy="true" aria-label="Cargando operaciones" className="divide-y divide-border border-y border-border">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex h-14 items-center">
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-cuerpo text-alerta">
        {error}
      </p>
    )
  }

  if (operaciones.length === 0) {
    return <p className="py-3 text-cuerpo text-ink-3">{textoVacio}</p>
  }

  return (
    <ListaFilas etiqueta="Operaciones">
      {operaciones.map((op) => (
        <FilaLista
          key={op.id}
          to={`/operaciones/${op.id}`}
          titulo={op.titulo || 'Sin título'}
          subtitulo={`${etiquetaTipoOperacion(op.tipo)} · ${etiquetaEstadoOperacion(op.estado)}`}
          datos={[
            op.monto != null ? (
              <span className="font-semibold text-ink">{formatearMonto(op.monto, op.moneda)}</span>
            ) : (
              <span className="text-meta text-primary">Cargar monto</span>
            ),
            <span className="text-meta text-ink-3">{formatearFecha(op.created_at)}</span>,
          ]}
          indicador={
            esOperacionTrabada(op.updated_at) ? (
              <span className="text-alerta">{diasSinMovimiento(op.updated_at)} días sin mover</span>
            ) : undefined
          }
        />
      ))}
    </ListaFilas>
  )
}
