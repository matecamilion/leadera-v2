import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  obtenerDetalleGestion,
  obtenerModeloGestionActivo,
  obtenerResumenGestion,
  type DetalleGestion,
  type MetricaGestion,
  type PeriodoGestion,
  type ResumenGestion,
} from '../lib/api/modeloGestion'
import { claves } from '../lib/queryKeys'
import { hoyEnArgentina } from '../lib/ritmoSemanal'
import { useUid } from './useUid'

/**
 * Si la inmobiliaria del usuario tiene el modelo de gestión prendido.
 *
 * El id sale del `profile` de `AuthContext`, que carga aparte de la sesión:
 * hasta que llega, la query no dispara y `data` queda `undefined`, que quien
 * la usa trata igual que false.
 */
export function useModeloGestionActivo() {
  const uid = useUid()
  const inmobiliariaId = useAuth().profile?.inmobiliaria_id

  return useQuery<boolean>({
    queryKey: claves.modeloGestion.activo(uid, inmobiliariaId),
    queryFn: () => obtenerModeloGestionActivo(inmobiliariaId!),
    enabled: !!uid && !!inmobiliariaId,
  })
}

/**
 * El resumen del día o de la semana que contiene `referencia` (null = en
 * curso). `enabled` es el flag de arriba, o que el panel esté abierto.
 */
export function useResumenGestion(
  periodo: PeriodoGestion,
  enabled: boolean,
  referencia: string | null = null,
) {
  const uid = useUid()
  const hoy = hoyEnArgentina()
  return useQuery<ResumenGestion>({
    queryKey: claves.modeloGestion.periodo(uid, periodo, hoy, referencia),
    queryFn: () => obtenerResumenGestion(periodo, referencia),
    enabled: !!uid && enabled,
  })
}

/** Las filas que suman a una métrica en el período, para el panel de detalle. */
export function useDetalleGestion(
  metrica: MetricaGestion,
  periodo: PeriodoGestion,
  referencia: string | null,
  enabled: boolean,
) {
  const uid = useUid()
  const hoy = hoyEnArgentina()
  return useQuery<DetalleGestion>({
    queryKey: claves.modeloGestion.detalle(uid, metrica, periodo, hoy, referencia),
    queryFn: () => obtenerDetalleGestion(metrica, periodo, referencia),
    enabled: !!uid && enabled,
  })
}
