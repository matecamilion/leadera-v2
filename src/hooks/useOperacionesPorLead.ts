import { useQuery } from '@tanstack/react-query'
import {
  contarInteraccionesPorLead,
  contarOperacionesPorLead,
  type ResumenInteracciones,
  type ResumenOperaciones,
} from '../lib/api/leads'

const VACIO_OPERACIONES: ResumenOperaciones = { compra: 0, venta: 0 }
const VACIO_INTERACCIONES: ResumenInteracciones = { cantidad: 0, ultimoDetalle: null }

/**
 * Segmento que separa estas claves de las de la ficha.
 *
 * `useOperacion.useOperacionesPorLead` —mismo nombre, otro archivo, otra forma:
 * devuelve el array de operaciones de UN lead— cachea bajo
 * `['operaciones-por-lead', leadId]`. Acá la clave es la lista de ids unida por
 * comas, así que con el listado filtrado a un solo lead las dos claves quedaban
 * idénticas y compartían entrada: si venías de la ficha de ese lead, el listado
 * leía el array de la ficha en vez de su Map y reventaba con
 * `data.get is not a function`, dejando la pantalla en blanco.
 *
 * El prefijo se mantiene a propósito: `useOperaciones` invalida
 * `['operaciones-por-lead']` entero y tiene que seguir alcanzando a estos.
 */
const RESUMEN = 'resumen'

/**
 * Resumen de operaciones de los leads ya cargados.
 * Depende del listado: sin ids no dispara.
 */
export function useOperacionesPorLead(leadIds: string[]) {
  const clave = leadIds.join(',')

  const { data } = useQuery({
    queryKey: ['operaciones-por-lead', RESUMEN, clave],
    queryFn: () => contarOperacionesPorLead(leadIds),
    enabled: leadIds.length > 0,
  })

  return (leadId: string): ResumenOperaciones => data?.get(leadId) ?? VACIO_OPERACIONES
}

/** Ídem para interacciones: cantidad y detalle de la última. */
export function useInteraccionesPorLead(leadIds: string[]) {
  const clave = leadIds.join(',')

  const { data } = useQuery({
    // Esta no colisiona hoy —nadie más usa la raíz `interacciones-por-lead`—
    // pero va segmentada igual, para que las dos del archivo se lean parejas.
    queryKey: ['interacciones-por-lead', RESUMEN, clave],
    queryFn: () => contarInteraccionesPorLead(leadIds),
    enabled: leadIds.length > 0,
  })

  return (leadId: string): ResumenInteracciones =>
    data?.get(leadId) ?? VACIO_INTERACCIONES
}
