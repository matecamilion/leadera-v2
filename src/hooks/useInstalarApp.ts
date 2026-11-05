import { useState, useSyncExternalStore } from 'react'
import {
  detectarPlataforma,
  leerInstalacion,
  pedirInstalacion,
  suscribirInstalacion,
} from '../lib/instalarApp'

export type EstadoInstalacion = 'instalada' | 'instalable' | 'guia_ios' | 'no_disponible'

/**
 * Estado de la instalación de la PWA y la acción de instalar.
 *
 * En iOS no hay diálogo nativo: `instalar` abre la guía, y quien usa el hook
 * la dibuja con `guiaAbierta` / `cerrarGuia`.
 */
export function useInstalarApp() {
  const { evento, instalada: instaladaPorEvento } = useSyncExternalStore(
    suscribirInstalacion,
    leerInstalacion,
  )
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  const { esIos, instalada } = detectarPlataforma()

  let estado: EstadoInstalacion
  if (instalada || instaladaPorEvento) estado = 'instalada'
  else if (evento) estado = 'instalable'
  else if (esIos) estado = 'guia_ios'
  else estado = 'no_disponible'

  async function instalar() {
    if (estado === 'guia_ios') setGuiaAbierta(true)
    else if (estado === 'instalable') await pedirInstalacion()
  }

  return { estado, instalar, guiaAbierta, cerrarGuia: () => setGuiaAbierta(false) }
}
