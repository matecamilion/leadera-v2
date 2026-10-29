import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  revertirImportacion,
  type ResultadoDeReversion,
  type SimulacionDeReversion,
} from '../lib/api/revertirImportacion'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/**
 * Deshacer una importación, en dos pasos: `simular` mira qué se eliminaría sin
 * tocar nada y `confirmar` lo elimina.
 *
 * Solo `confirmar` invalida el cache, y lo hace entre en lo que entre y también
 * si falla (una falla de red no dice si llegó a borrar). Mismas claves que
 * `useImportarLeads`, más lo que cambia al desaparecer leads: la carga por
 * miembro del equipo, las métricas del perfil y el dashboard. Los leads
 * eliminados además liberan cupo del plan (`usoRecursos`).
 */
export function useRevertirImportacion() {
  const queryClient = useQueryClient()
  const uid = useUid()

  const simular = useMutation<SimulacionDeReversion, Error, string>({
    mutationFn: (importacionId) => revertirImportacion(importacionId, false),
  })

  const confirmar = useMutation<ResultadoDeReversion, Error, string>({
    mutationFn: (importacionId) => revertirImportacion(importacionId, true),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
      queryClient.invalidateQueries({ queryKey: claves.leadsCombobox.raiz })
      queryClient.invalidateQueries({ queryKey: claves.usoRecursos.raiz })
      queryClient.invalidateQueries({ queryKey: claves.modeloGestion.resumen(uid) })
      queryClient.invalidateQueries({ queryKey: claves.tareas.raiz })
      queryClient.invalidateQueries({ queryKey: claves.equipo.raiz })
      queryClient.invalidateQueries({ queryKey: claves.perfil.raiz })
      queryClient.invalidateQueries({ queryKey: claves.dashboard.raiz })
      queryClient.invalidateQueries({ queryKey: claves.actividadReciente.raiz })
    },
  })

  return { simular, confirmar }
}
