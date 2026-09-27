import { useQuery } from '@tanstack/react-query'
import { obtenerEmbudo, type Embudo } from '../lib/api/perfil'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useEmbudo() {
  const uid = useUid()
  return useQuery<Embudo>({
    queryKey: claves.perfil.embudo(uid),
    queryFn: obtenerEmbudo,
    enabled: !!uid,
  })
}
