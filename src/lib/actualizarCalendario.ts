import type { ConexionGoogle, ResultadoImportacion } from './api/googleCalendar'

/**
 * Quién ve el botón "Actualizar" del calendario.
 *
 * Dueño, agente y asistente, siempre que haya algo que traer: Google conectado
 * e importación prendida. Para el asistente `conexion` es la de su agente (la
 * trae `mi_conexion_google`), porque el servidor importa la cuenta del agente.
 */
export function puedeActualizarCalendario(
  rol: string | null | undefined,
  conexion: Pick<ConexionGoogle, 'conectado' | 'importacionActiva'> | null | undefined,
): boolean {
  if (rol !== 'DUENO' && rol !== 'AGENTE' && rol !== 'ASISTENTE') return false
  return conexion?.conectado === true && conexion.importacionActiva === true
}

export interface EstadoActualizacion {
  tipo: 'actualizado' | 'error'
  mensaje: string
}

/**
 * Cómo se le cuenta al usuario lo que respondió el servidor.
 * `ya_actualizado` (enfriamiento) es "Actualizado": la vista ya estaba al día.
 *
 * Un asistente no puede reconectar Google: si hay que volver a autorizar,
 * el mensaje dice que lo resuelve su agente y no lo manda a su perfil.
 */
export function estadoDeActualizacion(
  resultado: ResultadoImportacion,
  rol?: string | null,
): EstadoActualizacion {
  const asistente = rol === 'ASISTENTE'
  switch (resultado) {
    case 'ok':
    case 'ya_actualizado':
      return { tipo: 'actualizado', mensaje: 'Actualizado' }
    case 'reautorizar':
      return {
        tipo: 'error',
        mensaje: asistente
          ? 'Google pide que tu agente vuelva a conectar su cuenta. Avisale: lo resuelve él.'
          : 'Google pide que vuelvas a conectar tu cuenta. Hacelo desde tu perfil.',
      }
    case 'reintentar':
      return { tipo: 'error', mensaje: 'Google tardó en responder. Probá de nuevo en unos segundos.' }
    case 'no_conectado':
    case 'importacion_no_activada':
      return {
        tipo: 'error',
        mensaje: asistente
          ? 'La importación de Google Calendar de tu agente no está activa.'
          : 'La importación de Google Calendar no está activa. Revisala en tu perfil.',
      }
    default:
      return { tipo: 'error', mensaje: 'No se pudo actualizar el calendario. Probá de nuevo.' }
  }
}
