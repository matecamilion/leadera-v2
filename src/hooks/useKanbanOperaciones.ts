import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarEstadoOperacion,
  listarOperacionesKanban,
  type EstadoOperacion,
  type TableroKanban,
  type TotalPorMoneda,
} from '../lib/api/operaciones'

/** La moneda más grande primero, igual que como los arma el RPC. */
function ordenados(totales: TotalPorMoneda[]): TotalPorMoneda[] {
  return totales.sort((a, b) => b.total - a.total)
}

/** Suma a la columna el monto de la card que entró. */
function conMontoSumado(
  totales: TotalPorMoneda[] | undefined,
  moneda: string,
  monto: number,
): TotalPorMoneda[] {
  const copia = (totales ?? []).map((t) => ({ ...t }))
  const existente = copia.find((t) => t.moneda === moneda)
  if (existente) existente.total += monto
  else copia.push({ moneda, total: monto })
  return ordenados(copia)
}

/**
 * Resta de la columna el monto de la card que salió.
 *
 * La moneda que queda en cero se saca en vez de quedar como "USD 0": si era la
 * única operación con monto de esa columna, el RPC tampoco la va a devolver en
 * el próximo refetch, así que sacarla apunta al mismo lado. Se lleva puesta una
 * columna cuyo monto real fuera 0 —posible, el monto admite 0—, pero eso dura
 * hasta que responde `onSettled`.
 */
function conMontoRestado(
  totales: TotalPorMoneda[] | undefined,
  moneda: string,
  monto: number,
): TotalPorMoneda[] {
  const restados = (totales ?? []).map((t) =>
    t.moneda === moneda ? { ...t, total: t.total - monto } : { ...t },
  )
  return ordenados(restados.filter((t) => t.total > 0))
}

export const CLAVE_KANBAN = ['operaciones', 'kanban'] as const

export function useKanbanOperaciones() {
  return useQuery<TableroKanban>({
    queryKey: CLAVE_KANBAN,
    queryFn: listarOperacionesKanban,
  })
}

interface MoverInput {
  id: string
  estado: EstadoOperacion
}

interface ContextoMovimiento {
  snapshotAnterior: TableroKanban | undefined
}

/**
 * Mueve una operación de columna con actualización optimista.
 *
 * Arrastrar y esperar el round-trip para ver la card en su lugar se siente
 * roto, así que la movemos en el cache antes de que responda el server. Si el
 * server rechaza —RLS, red, lo que sea— `onError` restaura el snapshot y la
 * card vuelve sola a su columna original.
 */
export function useMoverOperacion() {
  const queryClient = useQueryClient()

  return useMutation<unknown, Error, MoverInput, ContextoMovimiento>({
    mutationFn: ({ id, estado }) => actualizarEstadoOperacion(id, estado),

    onMutate: async ({ id, estado }) => {
      // Si hay un refetch en vuelo podría pisar el cambio optimista con datos
      // viejos justo después de aplicarlo.
      await queryClient.cancelQueries({ queryKey: CLAVE_KANBAN })

      const snapshotAnterior = queryClient.getQueryData<TableroKanban>(CLAVE_KANBAN)

      queryClient.setQueryData<TableroKanban>(CLAVE_KANBAN, (actual) => {
        if (!actual) return actual

        const movida = actual.operaciones.find((op) => op.id === id)
        const anterior = movida?.estado
        if (!movida || !anterior || anterior === estado) return actual

        // Los contadores y los montos del header salen de los RPC y no de las
        // filas, así que hay que moverlos a mano: si no, la card cambia de
        // columna pero los números quedan viejos hasta que responda el
        // refetch, que es justo el parpadeo que el update optimista evita.
        const totales = { ...actual.totales }
        totales[anterior] = Math.max(0, (totales[anterior] ?? 0) - 1)
        totales[estado] = (totales[estado] ?? 0) + 1

        const montos = { ...actual.montos }
        // Sin monto cargado la card no mueve ninguna moneda.
        if (movida.monto != null) {
          montos[anterior] = conMontoRestado(
            montos[anterior],
            movida.moneda,
            movida.monto,
          )
          montos[estado] = conMontoSumado(montos[estado], movida.moneda, movida.monto)
        }

        return {
          operaciones: actual.operaciones.map((op) =>
            op.id === id ? { ...op, estado } : op,
          ),
          totales,
          montos,
        }
      })

      return { snapshotAnterior }
    },

    onError: (_error, _input, contexto) => {
      if (contexto?.snapshotAnterior) {
        queryClient.setQueryData(CLAVE_KANBAN, contexto.snapshotAnterior)
      }
    },

    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: CLAVE_KANBAN })
      // El listado plano y la ficha muestran el mismo estado.
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
      queryClient.invalidateQueries({ queryKey: ['operacion', id] })
    },
  })
}
