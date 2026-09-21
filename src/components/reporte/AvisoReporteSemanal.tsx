import { useState } from 'react'
import { ModalActivarReporteSemanal } from './ModalActivarReporteSemanal'
import { IconoMail } from '../leads/Iconos'
import { useCambiarReporteSemanal, useReporteSemanal } from '../../hooks/useReporteSemanal'

const CLAVE_DESCARTADO = 'leadera.reporte-semanal.descartado'

/**
 * El descarte vive en el navegador y no en la base.
 *
 * Es cosmético —esconder una sugerencia— y no un dato del agente: guardarlo en
 * `profiles` pedía una segunda columna y su grant para algo que, en el peor
 * caso, se muestra una vez más en otra computadora. `reporte_semanal_activo`,
 * que sí es una decisión, sigue estando en la base.
 *
 * Todo en try/catch: en una ventana de incógnito o con el sitio bloqueado,
 * `localStorage` tira excepción al tocarlo, y este aviso no puede ser el motivo
 * de que Mi día no cargue.
 */
function leerDescartado(): boolean {
  try {
    return localStorage.getItem(CLAVE_DESCARTADO) === '1'
  } catch {
    return false
  }
}

function guardarDescartado(): void {
  try {
    localStorage.setItem(CLAVE_DESCARTADO, '1')
  } catch {
    // Sin storage el aviso vuelve la próxima vez. Es molesto, no roto.
  }
}

/**
 * La sugerencia de activar el reporte semanal, arriba de Mi día.
 *
 * Va acá y no sólo en Perfil porque nadie entra a Ajustes a descubrir que algo
 * existe: Mi día es la pantalla que el agente abre todos los días. El control
 * permanente —prender y apagar cuando quiera— sí vive en Perfil, al lado del
 * de Google Calendar.
 *
 * Desaparece solo en tres casos: ya está activo, el agente lo descartó, o la
 * query todavía no respondió (no se muestra y después se esconde, que se lee
 * como un parpadeo).
 */
export function AvisoReporteSemanal() {
  const { data: activo, isPending, isError } = useReporteSemanal()
  const cambiar = useCambiarReporteSemanal()
  const [confirmando, setConfirmando] = useState(false)
  const [descartado, setDescartado] = useState(leerDescartado)

  if (isPending || isError || activo === true || descartado) return null

  function descartar() {
    guardarDescartado()
    setDescartado(true)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-primary"
        >
          <IconoMail className="size-[18px]" />
        </span>

        <p className="m-0 min-w-0 flex-1 text-[0.85rem] leading-relaxed text-ink-2">
          ¿Sabías que podés recibir un reporte semanal con tu actividad? Te llega
          todos los lunes a la mañana.
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={descartar}
            className="rounded-lg px-3 py-1.5 text-[0.8rem] font-semibold text-ink-3 transition-colors hover:bg-background hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Ahora no
          </button>

          <button
            type="button"
            onClick={() => {
              cambiar.reset()
              setConfirmando(true)
            }}
            className="rounded-lg bg-brand-soft px-3 py-1.5 text-[0.8rem] font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Activar
          </button>
        </div>
      </div>

      {confirmando && (
        <ModalActivarReporteSemanal
          activando={cambiar.isPending}
          error={cambiar.isError ? cambiar.error.message : null}
          onConfirmar={() =>
            // Al quedar activo, el aviso desaparece solo: su propia query pasa
            // a `true`. No hace falta descartarlo a mano.
            cambiar.mutate(true, { onSuccess: () => setConfirmando(false) })
          }
          onCancelar={() => {
            cambiar.reset()
            setConfirmando(false)
          }}
        />
      )}
    </>
  )
}
