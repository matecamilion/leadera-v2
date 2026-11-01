import type { ConexionGoogle } from './api/googleCalendar'

/**
 * Qué ve cada rol de Google Calendar.
 *
 * Un ASISTENTE no conecta Google: opera el calendario de su agente, y el
 * servidor ya le rechaza conectar (oauth-init y callback devuelven 403). La UI
 * no le ofrece lo que el servidor le va a negar.
 */

export function esAsistente(rol: string | null | undefined): boolean {
  return rol === 'ASISTENTE'
}

/**
 * ¿Se le ofrece el banner de "Conectá tu Google Calendar"?
 * Mientras no se sabe el rol, no: mostrarlo medio segundo a un asistente y
 * esconderlo después sería un salto, y ofrecerle algo que no puede hacer.
 */
export function mostrarBannerConectar(rol: string | null | undefined): boolean {
  return !!rol && !esAsistente(rol)
}

export interface VistaGooglePerfil {
  /** Conectar / Reconectar / Volver a conectar / Desconectar y el toggle de importación. */
  gestiona: boolean
  /** Texto "Lo gestiona tu agente" con el estado de la conexión del agente. */
  loGestionaElAgente: boolean
  /** Un asistente con una fila propia conectada (limpieza): solo puede desconectarla. */
  soloDesconectar: boolean
}

export function vistaGooglePerfil(
  rol: string | null | undefined,
  propiaConectada: boolean,
): VistaGooglePerfil {
  if (esAsistente(rol)) {
    return { gestiona: false, loGestionaElAgente: true, soloDesconectar: propiaConectada }
  }
  return { gestiona: true, loGestionaElAgente: false, soloDesconectar: false }
}

export interface EstadoDelAgente {
  etiqueta: string
  detalle: string
  tono: 'ok' | 'aviso' | 'neutro'
}

/** El estado de la conexión del agente, contado para su asistente. */
export function estadoDelAgente(
  conexion: Pick<ConexionGoogle, 'conectado'> | null | undefined,
): EstadoDelAgente {
  if (conexion?.conectado === true) {
    return {
      etiqueta: 'Conectado',
      detalle: 'Las tareas y visitas que cargues aparecen en el Google Calendar de tu agente.',
      tono: 'ok',
    }
  }
  if (conexion) {
    return {
      etiqueta: 'Reconexión pendiente',
      detalle: 'Google dejó de aceptar el permiso de tu agente. Tiene que volver a conectar él.',
      tono: 'aviso',
    }
  }
  return {
    etiqueta: 'No conectado',
    detalle: 'Tu agente todavía no conectó su Google Calendar.',
    tono: 'neutro',
  }
}
