import { create } from 'zustand'

/**
 * Estado de UI puro. Nada de datos de servidor acá: eso vive en TanStack Query.
 *
 * Dos cosas: el drawer del sidebar en mobile —donde el sidebar fijo de 240px no
 * entra y se muestra como panel deslizable— y el aviso flash.
 */

/**
 * Aviso que sobrevive a una navegación.
 *
 * Existe para el caso "borré algo y me fui de la pantalla": el mensaje no puede
 * vivir en el componente que se acaba de desmontar. Se deja acá y lo dibuja
 * `AvisoFlash` desde el AppLayout, así la página de destino no necesita saber
 * nada. `tono` sólo elige el color.
 *
 * No es un sistema de notificaciones: hay un único aviso a la vez y el
 * siguiente pisa al anterior. Alcanza para confirmar una acción.
 */
export type TonoAviso = 'exito' | 'error'

export interface Aviso {
  mensaje: string
  tono: TonoAviso
  /** Cambia en cada aviso: le sirve al renderer para reiniciar el temporizador. */
  id: number
}

interface UiState {
  sidebarAbierto: boolean
  abrirSidebar: () => void
  cerrarSidebar: () => void
  alternarSidebar: () => void

  aviso: Aviso | null
  mostrarAviso: (mensaje: string, tono?: TonoAviso) => void
  limpiarAviso: () => void
}

let proximoIdDeAviso = 0

export const useUiStore = create<UiState>((set) => ({
  sidebarAbierto: false,
  abrirSidebar: () => set({ sidebarAbierto: true }),
  cerrarSidebar: () => set({ sidebarAbierto: false }),
  alternarSidebar: () => set((s) => ({ sidebarAbierto: !s.sidebarAbierto })),

  aviso: null,
  mostrarAviso: (mensaje, tono = 'exito') =>
    set({ aviso: { mensaje, tono, id: ++proximoIdDeAviso } }),
  limpiarAviso: () => set({ aviso: null }),
}))
