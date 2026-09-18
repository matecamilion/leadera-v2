import { useEffect, useRef } from 'react'
import { useDetallePropiedad } from './useDetallePropiedad'
import { seVinculaConBusqueda, type TipoOperacion } from '../lib/api/operaciones'

interface Params {
  tipo: TipoOperacion
  propiedadId: string | null
  leadId: string | null
  setLeadId: (id: string) => void
}

/**
 * En VENTA y ALQUILER el lead es el propietario: si la propiedad elegida ya
 * tiene uno cargado, se completa solo.
 *
 * Es una sugerencia, no un bloqueo, y nunca pisa a mano:
 *  - Sólo completa si el campo está vacío o si lo que hay lo puso este mismo
 *    hook (cambiar de propiedad cambia la sugerencia).
 *  - Una vez por propiedad: si el agente borra o cambia el lead sugerido, no se
 *    le vuelve a meter. Cambiar a un tipo que busca y volver cuenta como elegir
 *    de nuevo.
 *
 * Así una operación ya guardada que se abre para editar no se toca: su lead
 * no vino de acá.
 */
export function usePropietarioSugerido({ tipo, propiedadId, leadId, setLeadId }: Params) {
  const ofrece = !seVinculaConBusqueda(tipo)
  const { data: propiedad } = useDetallePropiedad(ofrece && propiedadId ? propiedadId : undefined)
  const propietarioId = propiedad?.id === propiedadId ? propiedad?.lead_propietario_id : null

  /** La propiedad para la que ya se sugirió. */
  const sugeridoPara = useRef<string | null>(null)
  /** El lead que puso la última sugerencia, para saber si se puede reemplazar. */
  const sugerido = useRef<string | null>(null)

  useEffect(() => {
    if (!ofrece || !propiedadId) {
      sugeridoPara.current = null
      return
    }
    if (!propietarioId || sugeridoPara.current === propiedadId) return

    sugeridoPara.current = propiedadId
    if (leadId === null || leadId === sugerido.current) {
      sugerido.current = propietarioId
      setLeadId(propietarioId)
    }
  }, [ofrece, propiedadId, propietarioId, leadId, setLeadId])
}
