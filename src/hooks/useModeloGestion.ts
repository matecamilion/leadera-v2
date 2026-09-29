import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  obtenerModeloGestionActivo,
  obtenerResumenSemanaGestion,
  type ResumenSemanaGestion,
} from '../lib/api/modeloGestion'
import { claves } from '../lib/queryKeys'
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

/** El resumen de la semana en curso. `enabled` es el flag de arriba. */
export function useResumenSemanaGestion(enabled: boolean) {
  const uid = useUid()
  return useQuery<ResumenSemanaGestion>({
    queryKey: claves.modeloGestion.semana(uid),
    queryFn: obtenerResumenSemanaGestion,
    enabled: !!uid && enabled,
  })
}
