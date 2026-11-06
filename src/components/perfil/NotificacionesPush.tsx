import { usePush } from '../../hooks/usePush'
import type { EstadoPush } from '../../lib/push'
import { BloqueSeccion, FilaAjuste, Interruptor } from './ajustes'

const TEXTO: Record<EstadoPush, string> = {
  inactivo: 'Activalas para recibir avisos de seguimientos y visitas en este dispositivo.',
  activo: 'Activas en este dispositivo. Para recibirlas en otro, activalas desde ahí.',
  bloqueado:
    'Tenés las notificaciones bloqueadas para LeadEra. Habilitalas desde el ícono de candado de la barra de direcciones y volvé a intentar.',
  requiere_instalar_ios:
    'En iPhone, instalá LeadEra primero: en Safari tocá Compartir > Agregar a pantalla de inicio y abrila desde ese ícono.',
  no_soportado: 'Este navegador no permite notificaciones.',
}

/** Las notificaciones push de este dispositivo. Se activan por dispositivo. */
export function NotificacionesPush() {
  const { estado, activando, activar, desactivar } = usePush()

  const encendido = estado === 'activo'
  const puedeCambiar = estado === 'activo' || estado === 'inactivo'

  return (
    <BloqueSeccion
      titulo="Avisos en este dispositivo"
      descripcion="Recibí avisos de LeadEra aunque no tengas la app abierta."
    >
      <FilaAjuste
        titulo="Notificaciones en este dispositivo"
        descripcion={estado ? TEXTO[estado] : undefined}
      >
        <div className="flex sm:justify-end">
          <Interruptor
            encendido={encendido}
            etiqueta="Recibir notificaciones en este dispositivo"
            deshabilitado={!puedeCambiar || activando}
            onAlternar={() => void (encendido ? desactivar() : activar())}
          />
        </div>
      </FilaAjuste>
    </BloqueSeccion>
  )
}
