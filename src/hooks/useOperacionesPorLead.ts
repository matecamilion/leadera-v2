import { useQuery } from '@tanstack/react-query'
import {
  contarInteraccionesPorLead,
  contarOperacionesPorLead,
  type ResumenInteracciones,
  type ResumenOperaciones,
} from '../lib/api/leads'
import { clasificarLeads, type RolLead } from '../lib/api/rolLead'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

const VACIO_OPERACIONES: ResumenOperaciones = { compra: 0, venta: 0 }
const VACIO_INTERACCIONES: ResumenInteracciones = { cantidad: 0, ultimoDetalle: null }

/*
 * Las claves de este archivo llevan la subclave `'resumen'` / `'rol'` (ver
 * `claves.operacionesPorLead`), que las separa de las de la ficha.
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
 * `claves.operacionesPorLead.raiz` entera y tiene que seguir alcanzando a estos.
 */

/**
 * Resumen de operaciones de los leads ya cargados.
 * Depende del listado: sin ids no dispara.
 */
export function useOperacionesPorLead(leadIds: string[]) {
  const uid = useUid()
  const clave = leadIds.join(',')

  const { data } = useQuery({
    queryKey: claves.operacionesPorLead.resumen(uid, clave),
    queryFn: () => contarOperacionesPorLead(leadIds),
    enabled: !!uid && leadIds.length > 0,
  })

  return (leadId: string): ResumenOperaciones => data?.get(leadId) ?? VACIO_OPERACIONES
}

/** Ídem para interacciones: cantidad y detalle de la última. */
export function useInteraccionesPorLead(leadIds: string[]) {
  const uid = useUid()
  const clave = leadIds.join(',')

  const { data } = useQuery({
    // Esta no colisiona hoy —nadie más usa la raíz `interacciones-por-lead`—
    // pero va segmentada igual, para que las dos del archivo se lean parejas.
    queryKey: claves.interaccionesPorLead.resumen(uid, clave),
    queryFn: () => contarInteraccionesPorLead(leadIds),
    enabled: !!uid && leadIds.length > 0,
  })

  return (leadId: string): ResumenInteracciones =>
    data?.get(leadId) ?? VACIO_INTERACCIONES
}

/**
 * Comprador / vendedor de los leads ya cargados. `null` = sin señal todavía.
 *
 * Cuelga de `operaciones-por-lead` a propósito: el rol sale en buena parte de
 * las operaciones, y así lo refresca la misma invalidación que ya disparan
 * sus altas y ediciones. Lo que cambia por propiedades o búsquedas se ve al
 * volver a montar la pantalla, porque la query no tiene `staleTime`.
 */
export function useRolesPorLead(leadIds: string[]) {
  const uid = useUid()
  const clave = leadIds.join(',')

  const { data } = useQuery({
    queryKey: claves.operacionesPorLead.rol(uid, clave),
    queryFn: () => clasificarLeads(leadIds),
    enabled: !!uid && leadIds.length > 0,
  })

  return (leadId: string): RolLead | null => data?.get(leadId) ?? null
}
