import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  importarLeads,
  type FilaParaImportar,
  type OpcionesDeImportacion,
  type ResultadoDeImportacion,
} from '../lib/api/importarLeads'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

interface ImportarLeadsInput extends OpcionesDeImportacion {
  filas: FilaParaImportar[]
}

/**
 * Importa leads por lotes (ver `importarLeads`).
 *
 * Invalida una sola vez al terminar, entre en lo que entre y también con un
 * corte a mitad: lo que ya se insertó tiene que verse. Las mismas claves que
 * `useCrearLead` y las del uso del plan que toca `useConsultas`, más el combobox
 * de leads, que cachea las búsquedas.
 */
export function useImportarLeads() {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation<ResultadoDeImportacion, Error, ImportarLeadsInput>({
    mutationFn: ({ filas, onProgreso }) => importarLeads(filas, { onProgreso }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
      queryClient.invalidateQueries({ queryKey: claves.modeloGestion.resumen(uid) })
      queryClient.invalidateQueries({ queryKey: claves.tareas.raiz })
      queryClient.invalidateQueries({ queryKey: claves.usoRecursos.raiz })
      queryClient.invalidateQueries({ queryKey: claves.leadsCombobox.raiz })
    },
  })
}
