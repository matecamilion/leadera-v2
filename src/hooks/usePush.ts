import { useCallback, useEffect, useState } from 'react'
import { activarPush, desactivarPush, estadoSoporte, type EstadoPush } from '../lib/push'
import { useUiStore } from '../stores/ui'

/**
 * Estado de las notificaciones push de ESTE dispositivo. Es estado del
 * navegador (permiso + suscripción), no de servidor: no usa TanStack Query.
 * `estado` es null hasta la primera lectura.
 */
export function usePush() {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [activando, setActivando] = useState(false)

  const evaluar = useCallback(async () => {
    setEstado(await estadoSoporte())
  }, [])

  useEffect(() => {
    let vivo = true
    let permiso: PermissionStatus | null = null
    const alCambiar = () => void evaluar()

    void estadoSoporte().then((siguiente) => {
      if (vivo) setEstado(siguiente)
    })
    // El usuario puede cambiar el permiso desde el candado del navegador.
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((p) => {
        if (!vivo) return
        permiso = p
        p.addEventListener('change', alCambiar)
      })
      .catch(() => undefined)

    return () => {
      vivo = false
      permiso?.removeEventListener('change', alCambiar)
    }
  }, [evaluar])

  // `activarPush` se llama sin awaits antes: Safari exige el gesto del click.
  const activar = useCallback(async () => {
    setActivando(true)
    try {
      await activarPush()
    } catch {
      mostrarAviso('No pudimos activar las notificaciones. Probá de nuevo en un rato.', 'error')
    } finally {
      setActivando(false)
      await evaluar()
    }
  }, [evaluar, mostrarAviso])

  const desactivar = useCallback(async () => {
    setActivando(true)
    try {
      await desactivarPush()
    } catch {
      mostrarAviso('No pudimos desactivar las notificaciones. Probá de nuevo en un rato.', 'error')
    } finally {
      setActivando(false)
      await evaluar()
    }
  }, [evaluar, mostrarAviso])

  return { estado, activando, activar, desactivar }
}
