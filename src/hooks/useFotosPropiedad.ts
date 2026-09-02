import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eliminarFotoPropiedad, subirFotoPropiedad, validarArchivo } from '../lib/api/storage'
import { clavePropiedad } from './useDetallePropiedad'

export interface Progreso {
  actual: number
  total: number
}

export function useFotosPropiedad(propiedadId: string) {
  const queryClient = useQueryClient()
  const [progreso, setProgreso] = useState<Progreso | null>(null)

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: clavePropiedad(propiedadId) })
    queryClient.invalidateQueries({ queryKey: ['propiedades'] })
  }

  const subir = useMutation({
    /**
     * En serie y no en paralelo: cada subida hace lectura + escritura del
     * array `fotos_urls`, y en paralelo la última en escribir pisaría a las
     * anteriores. Con hasta 10 fotos el costo de serializar es irrelevante.
     */
    mutationFn: async (archivos: File[]) => {
      for (const archivo of archivos) {
        const motivo = validarArchivo(archivo)
        if (motivo) throw new Error(motivo)
      }

      setProgreso({ actual: 0, total: archivos.length })
      try {
        for (let i = 0; i < archivos.length; i++) {
          await subirFotoPropiedad(propiedadId, archivos[i])
          setProgreso({ actual: i + 1, total: archivos.length })
        }
      } finally {
        setProgreso(null)
      }
    },
    onSuccess: refrescar,
    // Aunque falle a mitad de camino, las que sí subieron ya están guardadas.
    onError: refrescar,
  })

  const eliminar = useMutation({
    mutationFn: (url: string) => eliminarFotoPropiedad(propiedadId, url),
    onSuccess: refrescar,
  })

  return { subir, eliminar, progreso }
}
