import { Link } from 'react-router-dom'

/**
 * Salida hacia los planes desde un alta que rechazó una cuota.
 *
 * Va por `state` y no por query param: el modo de vista es efímero —si se
 * recarga, la pantalla vuelve a entrar por donde corresponda— y no es algo que
 * tenga sentido compartir en un link.
 *
 * Se muestra para cualquier rol, no sólo el dueño: un agente que choca el tope
 * necesita entender por qué se frenó, y la pantalla de destino ya le aclara que
 * contratar lo hace el dueño.
 */
export function EnlaceAPlanes() {
  return (
    <Link
      to="/suscripcion"
      state={{ vista: 'elegir' }}
      className="mt-1.5 inline-block font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-reduce:transition-none"
    >
      Ver planes →
    </Link>
  )
}
