import { useState } from 'react'
import { CLAVE_ESTILOS, guardar, leerGuardado } from './almacenamiento'
import {
  agregarEstilo,
  alternarPredeterminado,
  borrarEstilo,
  leerEstilos,
  renombrarEstilo,
  serializarEstilos,
  type ContenidoEstilo,
  type EstiloGuardado,
} from './estilos'

/** Los estilos del navegador. Cada cambio se guarda en el acto; sin storage, duran lo que dure la pantalla. */
export function useEstilosGuardados() {
  const [estilos, setEstilos] = useState(() => leerEstilos(leerGuardado(CLAVE_ESTILOS)))

  function aplicarCambio(siguiente: EstiloGuardado[]) {
    setEstilos(siguiente)
    guardar(CLAVE_ESTILOS, serializarEstilos(siguiente))
  }

  return {
    estilos,
    /** false si ya hay el máximo o el nombre está vacío. */
    guardarNuevo(nombre: string, contenido: ContenidoEstilo): boolean {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      const siguiente = agregarEstilo(estilos, id, nombre, contenido)
      if (!siguiente) return false
      aplicarCambio(siguiente)
      return true
    },
    renombrar: (id: string, nombre: string) => aplicarCambio(renombrarEstilo(estilos, id, nombre)),
    borrar: (id: string) => aplicarCambio(borrarEstilo(estilos, id)),
    alternarPredeterminado: (id: string) => aplicarCambio(alternarPredeterminado(estilos, id)),
  }
}
