import type { TipoOperacion } from '../../lib/api/operaciones'

/**
 * Barra lateral por tipo de operación. Mismos colores que `BadgeTipoOperacion`.
 *
 * En su propio módulo porque la usan la card del kanban y la lista compacta de
 * la ficha del lead: con dos tablas, agregar un tipo al enum dejaría una de las
 * dos sin color. Exportarla desde `CardKanban` también servía, pero un archivo
 * que exporta componentes y constantes a la vez rompe el fast refresh de Vite.
 */
export const BARRA: Record<TipoOperacion, string> = {
  VENTA: 'bg-primary',
  COMPRA: 'bg-frio',
  ALQUILER: 'bg-tibio',
  BUSQUEDA_ALQUILER: 'bg-info',
}
