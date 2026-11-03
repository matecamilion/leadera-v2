import { useState } from 'react'
import { useReactivarCuenta } from '../../hooks/useAdmin'
import { ETIQUETA_ESTADO, type CuentaAdmin } from '../../lib/api/admin'
import { useUiStore } from '../../stores/ui'
import { ModalAccionConNota } from './ModalAccionConNota'
import { AVISO_NOTA_INTERNA } from './textosAdmin'

const CLASES_BOTON =
  'rounded-lg bg-primary px-4 py-2.5 text-cuerpo font-semibold text-primary-contrast transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

/**
 * "Reactivar cuenta" con su modal. Pide una nota obligatoria, que es interna.
 *
 * Lo usan el bloque de la suspensión vigente y la zona de cuenta: es la misma
 * acción en los dos lugares donde se la va a buscar. La base decide en qué
 * estado queda la cuenta (activa, en prueba o vencida) y el aviso lo dice.
 */
export function BotonReactivarCuenta({ cuenta }: { cuenta: CuentaAdmin }) {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const reactivar = useReactivarCuenta()
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reactivar.reset()
          setAbierto(true)
        }}
        className={CLASES_BOTON}
      >
        Reactivar cuenta
      </button>

      <ModalAccionConNota
        abierto={abierto}
        titulo="¿Reactivar la cuenta?"
        subtitulo={cuenta.nombre}
        descripcion="Se levanta la suspensión y la cuenta vuelve al estado que le corresponde hoy: activa si tiene el acceso pago vigente, en prueba si la prueba sigue en curso, o vencida si ya no le corresponde acceso."
        placeholderNota="Por qué se reactiva."
        ayudaNota={AVISO_NOTA_INTERNA}
        textoConfirmar="Reactivar"
        textoConfirmando="Reactivando…"
        guardando={reactivar.isPending}
        error={reactivar.isError ? reactivar.error.message : null}
        onCerrar={() => {
          if (reactivar.isPending) return
          reactivar.reset()
          setAbierto(false)
        }}
        onConfirmar={(nota) =>
          reactivar.mutate(
            { inmobiliariaId: cuenta.id, nota },
            {
              onSuccess: (estado) => {
                setAbierto(false)
                mostrarAviso(`Cuenta reactivada: quedó ${ETIQUETA_ESTADO[estado].toLowerCase()}.`)
              },
            },
          )
        }
      />
    </>
  )
}
