import { useId, useState } from 'react'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { ModalFechaEscritura } from './ModalFechaEscritura'
import {
  useDesmarcarPaso,
  useFijarFechaPrevistaEscritura,
  useMarcarNoAplica,
  useMarcarPaso,
  useTramiteOperacion,
} from '../../hooks/useTramite'
import type { TramitePaso } from '../../lib/api/tramite'
import { mensajeDeGuardado } from '../../lib/mensajesDeError'
import { avisoDePostventa } from '../../lib/postventa'
import { hoyEnArgentina } from '../../lib/ritmoSemanal'
import {
  fechaInicialEscritura,
  PASOS_TRAMITE,
  pasosResueltos,
  textoEstadoTramite,
  type PasoTramite,
} from '../../lib/tramite'
import { useUiStore } from '../../stores/ui'

const CLASE_TARJETA = 'mb-4 rounded-[14px] border border-border bg-surface px-4 py-5 sm:px-6'

const CLASE_FECHA =
  'w-full max-w-[11rem] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.85rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)] disabled:opacity-60'

const CLASE_ACCION =
  'inline-flex min-h-10 items-center rounded-lg px-3 text-[0.8rem] font-semibold whitespace-nowrap text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 motion-reduce:transition-none'

/**
 * El checklist del trámite entre el acuerdo y la escritura.
 *
 * No mira el estado de la operación ni si está bloqueada: el trámite se sigue
 * editando con la operación cerrada. Quién decide si se monta es la ficha.
 *
 * Un paso tiene tres situaciones: pendiente, hecho (con fecha editable) o "no
 * aplica". Desmarcar no borra la fila, así que la fecha prevista de la
 * escritura sobrevive a marcarla y desmarcarla.
 */
export function ChecklistTramite({ operacionId }: { operacionId: string }) {
  const { data: filas, isPending, isError, error, refetch } = useTramiteOperacion(operacionId)
  const marcar = useMarcarPaso(operacionId)
  const noAplica = useMarcarNoAplica(operacionId)
  const desmarcar = useDesmarcarPaso(operacionId)
  const prevista = useFijarFechaPrevistaEscritura(operacionId)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [confirmandoEscritura, setConfirmandoEscritura] = useState(false)
  const hoy = hoyEnArgentina()

  if (isPending) {
    return (
      <div className={CLASE_TARJETA}>
        <div
          aria-busy="true"
          aria-label="Cargando el trámite"
          className="h-48 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={CLASE_TARJETA}>
        <p role="alert" className="text-[0.9rem] text-peligro-ink">
          {error instanceof Error ? error.message : 'No se pudo cargar el trámite.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-[0.85rem] font-semibold text-primary hover:underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const resueltos = pasosResueltos(filas)
  const guardando =
    marcar.isPending || noAplica.isPending || desmarcar.isPending || prevista.isPending
  const falla = [marcar, noAplica, desmarcar, prevista].find((m) => m.error)?.error

  // Un error viejo de una acción no tiene que quedar pegado cuando sale otra.
  function empezar() {
    marcar.reset()
    noAplica.reset()
    desmarcar.reset()
    prevista.reset()
  }

  // Sin fecha, la de hoy. El diálogo de la escritura se cierra al terminar, bien
  // o mal: si falla, el motivo queda en el aviso de la tarjeta, que el diálogo
  // abierto taparía.
  function marcarPaso(paso: PasoTramite, fecha?: string) {
    empezar()
    marcar.mutate(
      { paso, fecha },
      {
        onSuccess: ({ agendadas }) => {
          const aviso = avisoDePostventa(agendadas)
          if (aviso) mostrarAviso(aviso)
        },
        onSettled: () => setConfirmandoEscritura(false),
      },
    )
  }

  const escritura = filas.find((f) => f.paso === 'ESCRITURA')

  return (
    <div className={CLASE_TARJETA}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-xs font-bold tracking-[0.04em] text-ink-3 uppercase">
          Trámite de escritura
        </h2>
        <span className="text-[0.85rem] font-bold text-ink tabular-nums">
          {resueltos} de {PASOS_TRAMITE.length}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Pasos del trámite resueltos"
        aria-valuemin={0}
        aria-valuemax={PASOS_TRAMITE.length}
        aria-valuenow={resueltos}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(resueltos / PASOS_TRAMITE.length) * 100}%` }}
        />
      </div>

      <p className="mt-2.5 mb-1 text-[0.85rem] break-words text-ink-2">{textoEstadoTramite(filas)}</p>

      <ul className="divide-y divide-border">
        {PASOS_TRAMITE.map((paso) => (
          <FilaPaso
            key={paso.clave}
            clave={paso.clave}
            etiqueta={paso.etiqueta}
            fila={filas.find((f) => f.paso === paso.clave)}
            hoy={hoy}
            deshabilitado={guardando}
            // La escritura pide la fecha antes de marcarse; el resto se marca con hoy.
            onTildar={() =>
              paso.clave === 'ESCRITURA' ? setConfirmandoEscritura(true) : marcarPaso(paso.clave)
            }
            onMarcar={(fecha) => marcarPaso(paso.clave, fecha)}
            onDesmarcar={() => {
              empezar()
              desmarcar.mutate(paso.clave)
            }}
            onNoAplica={() => {
              empezar()
              noAplica.mutate(paso.clave)
            }}
            onFechaPrevista={(fecha) => {
              empezar()
              prevista.mutate(fecha)
            }}
          />
        ))}
      </ul>

      {falla && (
        <p role="alert" className="mt-3 text-[0.82rem] break-words text-peligro-ink">
          {mensajeDeGuardado(falla, 'No se pudo guardar el paso del trámite.')}
        </p>
      )}

      {confirmandoEscritura && (
        <ModalFechaEscritura
          fechaInicial={fechaInicialEscritura(escritura?.fecha_prevista ?? null, hoy)}
          hoy={hoy}
          postventaYaGenerada={!!escritura?.postventa_generada_at}
          procesando={marcar.isPending}
          onConfirmar={(fecha) => marcarPaso('ESCRITURA', fecha)}
          onCancelar={() => setConfirmandoEscritura(false)}
        />
      )}
    </div>
  )
}

interface FilaPasoProps {
  clave: PasoTramite
  etiqueta: string
  fila: TramitePaso | undefined
  hoy: string
  deshabilitado: boolean
  /** Tildar la casilla: marca con hoy, o pide la fecha si es la escritura. */
  onTildar: () => void
  /** Cambiar la fecha de un paso ya hecho. */
  onMarcar: (fecha?: string) => void
  onDesmarcar: () => void
  onNoAplica: () => void
  onFechaPrevista: (fecha: string | null) => void
}

function FilaPaso({
  clave,
  etiqueta,
  fila,
  hoy,
  deshabilitado,
  onTildar,
  onMarcar,
  onDesmarcar,
  onNoAplica,
  onFechaPrevista,
}: FilaPasoProps) {
  const idEtiqueta = useId()
  const fecha = fila?.fecha_completado ?? null
  const hecho = fecha !== null
  const sinAplicar = fila?.no_aplica === true
  const mostrarPrevista = clave === 'ESCRITURA' && !hecho && !sinAplicar

  const textoAccion = sinAplicar ? 'Revertir "no aplica"' : 'No aplica'
  const accion = sinAplicar ? onDesmarcar : onNoAplica

  return (
    <li className="flex items-start gap-3 py-3">
      <label className="-my-1.5 -ml-2.5 grid size-11 shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          checked={hecho}
          disabled={deshabilitado}
          aria-labelledby={idEtiqueta}
          onChange={(e) => (e.target.checked ? onTildar() : onDesmarcar())}
          className="size-5 cursor-pointer accent-primary disabled:cursor-default"
        />
      </label>

      <div className="min-w-0 flex-1">
        <p
          id={idEtiqueta}
          className={`m-0 text-[0.92rem] leading-snug font-semibold break-words ${
            sinAplicar ? 'text-ink-4' : 'text-ink'
          }`}
        >
          {etiqueta}
          {sinAplicar && (
            <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 align-middle text-[0.7rem] font-bold text-ink-3">
              No aplica
            </span>
          )}
        </p>

        {hecho && (
          <CampoFecha
            key={fecha}
            etiqueta={`Fecha de "${etiqueta}"`}
            titulo="Fecha"
            valor={fecha}
            max={hoy}
            deshabilitado={deshabilitado}
            onGuardar={(nueva) => onMarcar(nueva ?? undefined)}
          />
        )}

        {mostrarPrevista && (
          <CampoFecha
            key={fila?.fecha_prevista ?? ''}
            etiqueta="Fecha prevista de la escritura"
            titulo="Fecha prevista"
            valor={fila?.fecha_prevista ?? null}
            min={hoy}
            permiteVaciar
            deshabilitado={deshabilitado}
            onGuardar={onFechaPrevista}
          />
        )}
      </div>

      <div className="hidden shrink-0 md:block">
        <button type="button" disabled={deshabilitado} onClick={accion} className={CLASE_ACCION}>
          {textoAccion}
        </button>
      </div>

      <div className="-my-1.5 -mr-2 shrink-0 md:hidden">
        <MenuDesplegable
          etiqueta={`Más acciones para "${etiqueta}"`}
          alinear="derecha"
          claseBoton="inline-flex size-11 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          boton={
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          }
          items={[{ label: textoAccion, onSelect: accion }]}
        />
      </div>
    </li>
  )
}

interface CampoFechaProps {
  /** Nombre accesible del input. */
  etiqueta: string
  /** Rótulo visible. */
  titulo: string
  valor: string | null
  min?: string
  max?: string
  /** Borrar el campo borra el dato. Si no, un campo vacío vuelve al valor guardado. */
  permiteVaciar?: boolean
  deshabilitado: boolean
  onGuardar: (fecha: string | null) => void
}

/**
 * Un `<input type="date">` que guarda al elegir una fecha válida.
 *
 * Mientras se tipea, el navegador manda valores vacíos o incompletos: por eso se
 * edita un borrador y recién se guarda lo que está completo y dentro de rango.
 * Quien lo monta le pone `key={valor}` para soltar el borrador cuando llega el
 * valor guardado.
 */
function CampoFecha({
  etiqueta,
  titulo,
  valor,
  min,
  max,
  permiteVaciar = false,
  deshabilitado,
  onGuardar,
}: CampoFechaProps) {
  const idError = useId()
  const [borrador, setBorrador] = useState<string | null>(null)
  const actual = borrador ?? valor ?? ''

  const error =
    max && actual > max
      ? 'La fecha no puede ser futura.'
      : min && actual !== '' && actual < min
        ? 'La fecha no puede ser anterior a hoy.'
        : null

  function alCambiar(nuevo: string) {
    setBorrador(nuevo)
    const enRango = (!max || nuevo <= max) && (!min || nuevo >= min)
    if (nuevo !== '' && enRango && nuevo !== valor) onGuardar(nuevo)
  }

  function alSalir() {
    if (borrador === null) return
    if (borrador === '' && permiteVaciar && valor) {
      onGuardar(null)
      return
    }
    // Vacío o fuera de rango: no se guardó, así que se vuelve a lo guardado.
    if (borrador === '' || error) setBorrador(null)
  }

  return (
    <label className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-xs font-semibold text-ink-3 uppercase">{titulo}</span>
      <input
        type="date"
        aria-label={etiqueta}
        value={actual}
        min={min}
        max={max}
        disabled={deshabilitado}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        onChange={(e) => alCambiar(e.target.value)}
        onBlur={alSalir}
        className={CLASE_FECHA}
      />
      {error && (
        <span id={idError} className="basis-full text-[0.78rem] text-peligro-ink">
          {error}
        </span>
      )}
    </label>
  )
}
