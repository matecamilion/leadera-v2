import { useQuery } from '@tanstack/react-query'
import { obtenerEmbudo, type Embudo } from '../lib/api/perfil'

export const CLAVE_EMBUDO = ['perfil', 'embudo'] as const

export function useEmbudo() {
  return useQuery<Embudo>({
    queryKey: CLAVE_EMBUDO,
    queryFn: obtenerEmbudo,
  })
}
