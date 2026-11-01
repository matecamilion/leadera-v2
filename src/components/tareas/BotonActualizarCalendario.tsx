import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useActualizarCalendario, useConexionGoogle } from '../../hooks/useGoogleCalendar'
import { estadoDeActualizacion, puedeActualizarCalendario } from '../../lib/actualizarCalendario'

/** Cuánto se queda el "Actualizado" antes de volver a "Actualizar". */
const MS_ACTUALIZADO = 3000

/**
 * "Actualizar" del calendario: trae ya los eventos de Google Calendar, sin
 * esperar los 3 minutos del cron, y refresca la grilla.
 *
 * Se muestra solo si hay algo que traer (ver `puedeActualizarCalendario`). El
 * enfriamiento de 15 s lo resuelve el servidor y vuelve como "Actualizado".
 */
export function BotonActualizarCalendario() {
  const { profile } = useAuth()
  const conexion = useConexionGoogle()
  const actualizar = useActualizarCalendario()
  const [mensaje, setMensaje] = useState<{ tipo: 'actualizado' | 'error'; texto: string } | null>(null)

  // El "Actualizado" se apaga solo; un error se queda hasta el próximo intento.
  useEffect(() => {
    if (mensaje?.tipo !== 'actualizado') return
    const id = window.setTimeout(() => setMensaje(null), MS_ACTUALIZADO)
    return () => window.clearTimeout(id)
  }, [mensaje])

  if (!puedeActualizarCalendario(profile?.rol, conexion.data)) return null

  function pedir() {
    setMensaje(null)
    actualizar.mutate(undefined, {
      onSuccess: (respuesta) => {
        const estado = estadoDeActualizacion(respuesta.resultado, profile?.rol)
        setMensaje({ tipo: estado.tipo, texto: estado.mensaje })
      },
      onError: (err) => setMensaje({ tipo: 'error', texto: err.message }),
    })
  }

  const cargando = actualizar.isPending
  const etiqueta = cargando ? 'Actualizando…' : mensaje?.tipo === 'actualizado' ? 'Actualizado' : 'Actualizar'

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={pedir}
        disabled={cargando}
        aria-busy={cargando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background disabled:opacity-55 motion-reduce:transition-none"
      >
        {etiqueta}
      </button>
      {mensaje?.tipo === 'error' && (
        <p role="alert" className="m-0 max-w-[16rem] text-[0.8rem] text-peligro-ink">
          {mensaje.texto}
        </p>
      )}
    </div>
  )
}
