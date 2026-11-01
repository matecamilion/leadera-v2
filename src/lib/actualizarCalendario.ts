import type { ConexionGoogle, ResultadoImportacion } from './api/googleCalendar'

/**
 * Quién ve el botón "Actualizar" del calendario.
 *
 * Solo dueño o agente con Google conectado y la importación prendida: sin eso
 * no hay nada que traer. El asistente todavía no (no puede leer el estado de
 * la conexión de su agente); el servidor igual lo soporta.
 */
export function puedeActualizarCalendario(
  rol: string | null | undefined,
  conexion: Pick<ConexionGoogle, 'conectado' | 'importacionActiva'> | null | undefined,
): boolean {
  if (rol !== 'DUENO' && rol !== 'AGENTE') return false
  return conexion?.conectado === true && conexion.importacionActiva === true
}

export interface EstadoActualizacion {
  tipo: 'actualizado' | 'error'
  mensaje: string
}

/**
 * Cómo se le cuenta al usuario lo que respondió el servidor.
 * `ya_actualizado` (enfriamiento) es "Actualizado": la vista ya estaba al día.
 */
export function estadoDeActualizacion(resultado: ResultadoImportacion): EstadoActualizacion {
  switch (resultado) {
    case 'ok':
    case 'ya_actualizado':
      return { tipo: 'actualizado', mensaje: 'Actualizado' }
    case 'reautorizar':
      return {
        tipo: 'error',
        mensaje: 'Google pide que vuelvas a conectar tu cuenta. Hacelo desde tu perfil.',
      }
    case 'reintentar':
      return { tipo: 'error', mensaje: 'Google tardó en responder. Probá de nuevo en unos segundos.' }
    case 'no_conectado':
    case 'importacion_no_activada':
      return {
        tipo: 'error',
        mensaje: 'La importación de Google Calendar no está activa. Revisala en tu perfil.',
      }
    default:
      return { tipo: 'error', mensaje: 'No se pudo actualizar el calendario. Probá de nuevo.' }
  }
}
