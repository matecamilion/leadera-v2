import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ErrorStorage,
  eliminarFotoPropiedad,
  moverFotoAlInicio,
  subirFotoPropiedad,
  validarArchivo,
} from '../lib/api/storage'
import { planearLote, type FalloDeSubida, type ResultadoLote } from '../lib/fotosLote'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export interface Progreso {
  actual: number
  total: number
}

export function useFotosPropiedad(propiedadId: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  // Aparte de `progreso`: acá `actual` es la foto que se está subiendo (la 2 de
  // 3), no cuántas terminaron.
  const [progresoLote, setProgresoLote] = useState<Progreso | null>(null)

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: claves.propiedad.detalle(uid, propiedadId) })
    queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz })
  }

  // Lo mismo, pero devuelve la promesa: `subirLote` espera a que las listas se
  // vuelvan a leer. `refrescar` no, para que `subir` se comporte como siempre.
  function refrescarYEsperar() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: claves.propiedad.detalle(uid, propiedadId) }),
      queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz }),
    ])
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

  /**
   * Sube un lote que tolera fallas: sigue con las demás cuando una falla por
   * formato o red, y cuenta qué pasó. Es la contracara de `subir`, que valida
   * todo de antemano y corta en la primera.
   *
   * Sólo corta antes de tiempo ante un error de permiso (`esPermiso`): el
   * archivo se sube al bucket antes de escribir la propiedad, y seguir con otro
   * dejaría un objeto huérfano más.
   *
   * Lo que no entra por el tope de fotos no se intenta. Sigue en serie, por el
   * read-modify-write de `fotos_urls`. Resuelve siempre con un resultado; la
   * mutación queda pendiente hasta que las listas se refrescan, así quien la
   * usa ve el estado final y no uno viejo.
   */
  const subirLote = useMutation({
    mutationFn: async ({
      archivos,
      fotosActuales,
    }: {
      archivos: File[]
      fotosActuales: number
    }): Promise<ResultadoLote> => {
      const { aSubir, descartadas } = planearLote(archivos, fotosActuales)
      const fallos: FalloDeSubida[] = []
      let subidas = 0
      let cortadoPorPermiso = false

      try {
        for (let i = 0; i < aSubir.length; i++) {
          setProgresoLote({ actual: i + 1, total: aSubir.length })
          try {
            await subirFotoPropiedad(propiedadId, aSubir[i])
            subidas++
          } catch (e) {
            fallos.push({
              archivo: aSubir[i].name,
              motivo: e instanceof Error ? e.message : 'No se pudo subir la foto.',
            })
            if (e instanceof ErrorStorage && e.esPermiso) {
              cortadoPorPermiso = true
              break
            }
          }
        }
      } finally {
        setProgresoLote(null)
      }

      return { subidas, total: aSubir.length, descartadas, fallos, cortadoPorPermiso }
    },
    onSettled: refrescarYEsperar,
  })

  const eliminar = useMutation({
    mutationFn: (url: string) => eliminarFotoPropiedad(propiedadId, url),
    onSuccess: refrescar,
  })

  const portada = useMutation({
    mutationFn: (url: string) => moverFotoAlInicio(propiedadId, url),
    onSuccess: refrescar,
  })

  return { subir, subirLote, eliminar, portada, progreso, progresoLote }
}
