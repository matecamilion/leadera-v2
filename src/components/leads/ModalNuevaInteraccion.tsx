import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCrearInteraccion } from '../../hooks/useInteracciones'
import { TIPOS_INTERACCION, type TipoInteraccion } from '../../lib/api/interacciones'
import { esMomentoPasado, hoyComoMinimoLocal } from '../../lib/calendario'
import { DETALLE_MINIMO } from '../../lib/validaciones'
import { mensajeDeGuardado } from '../../lib/mensajesDeError'
import { Campo, ErrorCampo } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'
import { IconoCalendario } from './Iconos'

/** Lo mismo que pide la página: un detalle de una palabra no sirve de historial. */

/** Atajos de agenda: hoy + N días, respetando la hora actual. */
const ATAJOS = [
  { dias: 1, label: 'Mañana' },
  { dias: 3, label: 'En 3 días' },
  { dias: 7, label: '1 semana' },
]

/**
 * Formato que espera <input type="datetime-local">: YYYY-MM-DDTHH:mm local.
 *
 * Copia de la de `pages/NuevaInteraccion`, que sigue viva. Se duplica a
 * propósito en vez de mudarla a `lib/calendario`: la página queda sin uso con
 * este cambio y cuando se borre, la copia se va con ella.
 */
function enDias(dias: number): string {
  const f = new Date()
  f.setDate(f.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`
}

interface ModalNuevaInteraccionProps {
  abierto: boolean
  leadId: string
  /** Para el subtítulo. Sin él se usa un texto genérico. */
  nombreLead?: string
  onCerrar: () => void
  /**
   * Después de un alta exitosa, y siempre después de `onCerrar`.
   *
   * No hace falta para refrescar nada —de eso se encarga `useCrearInteraccion`,
   * que invalida el timeline, la ficha y el listado—; está para lo que sí
   * decide el padre, como el aviso de confirmación.
   */
  onCreada?: () => void
}

/**
 * Alta de una interacción sin salir de donde estás.
 *
 * Es el formulario de `pages/NuevaInteraccion` metido en el shell de
 * `ModalEditarInteraccion` —<dialog> nativo, controles de `CampoFormulario` /
 * `estilosFormulario`, `onCancel` interceptado—. Mismos campos y mismas
 * validaciones que la página: tipo, detalle con mínimo de caracteres y el
 * próximo contacto con sus tres atajos.
 *
 * El punto de que sea modal es no navegar: desde el listado, el agente pierde
 * el filtro y la página apenas se va de `/leads`, porque ese estado vive en
 * React y no en la URL. Al guardar, esto cierra y nada más — quien lo abrió
 * sigue exactamente donde estaba.
 *
 * La mutación vive acá adentro y no en el padre (al revés que en
 * `ModalEditarInteraccion`) porque lo montan dos pantallas: así el wiring de
 * invalidación no se escribe dos veces.
 *
 * La fecha de la interacción no se pide, igual que en la página: la pone la
 * base con `now()`. Si hace falta cargar una charla de ayer, se corrige después
 * desde el timeline, que para eso tiene la edición.
 */
export function ModalNuevaInteraccion({
  abierto,
  leadId,
  nombreLead,
  onCerrar,
  onCreada,
}: ModalNuevaInteraccionProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const crear = useCrearInteraccion()

  const [tipo, setTipo] = useState<TipoInteraccion | ''>('')
  const [detalle, setDetalle] = useState('')
  const [proximo, setProximo] = useState('')
  const [tocado, setTocado] = useState(false)

  // `reset` de TanStack Query es estable entre renders, pero sacarlo del objeto
  // de la mutación lo deja explícito y evita que el efecto dependa de `crear`,
  // que cambia de identidad en cada render.
  const { reset: resetMutacion } = crear

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (abierto && !dialog.open) {
      // Cada apertura arranca en blanco: si la anterior se canceló a medias,
      // no queremos ver ese borrador —ni el error de un intento viejo— cuando
      // el modal se reabre sobre otro lead.
      setTipo('')
      setDetalle('')
      setProximo('')
      setTocado(false)
      resetMutacion()
      dialog.showModal()
    }

    if (!abierto && dialog.open) dialog.close()
  }, [abierto, leadId, resetMutacion])

  const errorTipo = tocado && !tipo ? 'Este campo es obligatorio' : null
  const errorDetalle = !tocado
    ? null
    : !detalle.trim()
      ? 'El detalle es obligatorio'
      : detalle.trim().length < DETALLE_MINIMO
        ? `Mínimo ${DETALLE_MINIMO} caracteres`
        : null

  // El próximo contacto se agenda hacia adelante, y acá el corte es contra el
  // reloj y no contra el día: el agente elige la hora a mano, así que dejar
  // pasar "hoy a las 9" cuando son las 15 sería agendar para atrás.
  //
  // Es más estricto que el resto de los formularios de la app, que usan
  // `esMomentoDeDiaPasado`. Los atajos (Mañana / En 3 días / 1 semana) no se
  // ven afectados: por construcción caen siempre adelante.
  const proximoPasado = !!proximo && esMomentoPasado(proximo)

  const valido =
    Boolean(tipo) && detalle.trim().length >= DETALLE_MINIMO && !proximoPasado

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido) return
    // El botón ya se deshabilita mientras guarda, pero un Enter repetido llega
    // por el submit del form sin pasar por él y duplicaría la interacción.
    if (crear.isPending) return

    crear.mutate(
      {
        lead_id: leadId,
        tipo: tipo as TipoInteraccion,
        detalle,
        fecha_proximo_contacto: proximo || undefined,
      },
      {
        onSuccess: () => {
          onCerrar()
          onCreada?.()
        },
      },
    )
  }

  return (
    <dialog
      ref={ref}
      aria-label="Registrar una interacción"
      // El Escape del <dialog> cierra sin avisar al padre: lo interceptamos
      // para que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!crear.isPending) onCerrar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[480px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-1 text-center text-lg font-bold text-ink">
          Nueva interacción
        </h3>
        <p className="mb-5 text-center text-[0.85rem] text-ink-3">
          {nombreLead
            ? `Registrá la conversación con ${nombreLead}.`
            : 'Registrá la conversación y programá el próximo contacto.'}
        </p>

        <div className="flex flex-col gap-4">
          <Campo label="Tipo *">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoInteraccion)}
              onBlur={() => setTocado(true)}
              aria-invalid={Boolean(errorTipo) || undefined}
              className={`${CLASES_CONTROL} ${errorTipo ? 'border-peligro-ink' : ''}`}
            >
              <option value="" disabled>
                Seleccioná una opción...
              </option>
              {TIPOS_INTERACCION.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
            {errorTipo && <ErrorCampo>{errorTipo}</ErrorCampo>}
          </Campo>

          <Campo label="Detalle *">
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              onBlur={() => setTocado(true)}
              rows={4}
              maxLength={1000}
              placeholder="Qué pasó con el lead..."
              aria-invalid={Boolean(errorDetalle) || undefined}
              className={`${CLASES_CONTROL} min-h-24 resize-y leading-normal ${
                errorDetalle ? 'border-peligro-ink' : ''
              }`}
            />
            {errorDetalle && <ErrorCampo>{errorDetalle}</ErrorCampo>}
          </Campo>
        </div>

        <fieldset className="mt-4 rounded-xl border border-border bg-background p-4">
          <legend className="px-1 text-[0.85rem] font-semibold text-ink-2">
            ¿Cuándo volvemos a contactar?
          </legend>
          <p className="mb-3 text-xs text-ink-3">
            Opcional. Programá el seguimiento para que aparezca en tu agenda.
          </p>

          <div className="mb-3 flex gap-2">
            {ATAJOS.map((atajo) => (
              <button
                key={atajo.dias}
                type="button"
                onClick={() => setProximo(enDias(atajo.dias))}
                className="flex-1 rounded-lg border border-border bg-surface p-2 text-[0.8rem] font-semibold text-ink-3 transition-colors hover:border-primary hover:bg-primary hover:text-white motion-reduce:transition-none"
              >
                {atajo.label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center">
            <IconoCalendario className="pointer-events-none absolute right-3 size-5 text-ink-3" />
            <input
              type="datetime-local"
              aria-label="Fecha del próximo contacto"
              value={proximo}
              min={hoyComoMinimoLocal()}
              onChange={(e) => setProximo(e.target.value)}
              aria-invalid={proximoPasado || undefined}
              className={`${CLASES_CONTROL} ${proximoPasado ? 'border-peligro-ink' : ''}`}
            />
          </div>
          {proximoPasado && (
            <ErrorCampo>El próximo contacto no puede ser una fecha pasada.</ErrorCampo>
          )}
        </fieldset>

        {crear.isError && (
          <p role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            {mensajeDeGuardado(crear.error, 'No se pudo registrar la interacción.')}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={crear.isPending}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold text-ink-3 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || crear.isPending}
            className="flex-1 rounded-lg border-none bg-primary px-4 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {crear.isPending ? 'Guardando…' : 'Guardar interacción'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
