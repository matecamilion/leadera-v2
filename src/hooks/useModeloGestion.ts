import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  obtenerModeloGestionActivo,
  obtenerResumenGestion,
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

/** El resumen del día o de la semana en curso. `enabled` es el flag de arriba. */
export function useResumenGestion(periodo: PeriodoGestion, enabled: boolean) {
  const uid = useUid()
  const hoy = hoyEnArgentina()
  return useQuery<ResumenGestion>({
    queryKey: claves.modeloGestion.periodo(uid, periodo, hoy),
    queryFn: () => obtenerResumenGestion(periodo),
    enabled: !!uid && enabled,
  })
}
