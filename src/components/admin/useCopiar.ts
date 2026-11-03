import { useUiStore } from '../../stores/ui'

/**
 * Copia un texto al portapapeles y avisa cómo salió.
 *
 * Sin permiso de portapapeles —o sin HTTPS— no hay forma de copiar por código:
 * se avisa en vez de fallar en silencio.
 */
export function useCopiar() {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  return async (texto: string, mensajeExito: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      mostrarAviso(mensajeExito)
    } catch {
      mostrarAviso('No se pudo copiar. Revisá los permisos del navegador.', 'error')
    }
  }
}
