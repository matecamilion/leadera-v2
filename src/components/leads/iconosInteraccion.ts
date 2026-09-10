import {
  IconoCasa,
  IconoChat,
  IconoConversacion,
  IconoLapiz,
  IconoMail,
  IconoReloj,
  IconoTelefono,
  IconoUsuarios,
} from './Iconos'
import type { TipoInteraccion } from '../../lib/api/interacciones'

/**
 * Ícono por tipo de interacción.
 *
 * En su propio módulo y no adentro de `TimelineInteracciones`: lo usan el
 * timeline y la preview del resumen de la ficha, y con dos tablas, agregar un
 * tipo al enum dejaría una de las dos con el ícono de fallback sin que nadie se
 * entere. Exportarlo desde el componente también servía, pero un archivo que
 * exporta componentes y constantes a la vez rompe el fast refresh de Vite.
 */
export const ICONOS: Record<
  TipoInteraccion,
  (p: { className?: string }) => React.ReactElement
> = {
  LLAMADA: IconoTelefono,
  WHATSAPP: IconoChat,
  EMAIL: IconoMail,
  VISITA: IconoCasa,
  REUNION: IconoUsuarios,
  NOTA_INTERNA: IconoLapiz,
  SEGUIMIENTO: IconoReloj,
  // Se registra desde el timeline de una operación, pero cae en el historial
  // del lead como cualquier otra.
  CONSULTA: IconoConversacion,
}
