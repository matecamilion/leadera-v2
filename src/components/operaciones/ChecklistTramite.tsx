import { useEffect, useId, useState } from 'react'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { ModalFechaEscritura } from './ModalFechaEscritura'
import {
  useDesmarcarPaso,
  useFijarFechaPrevistaEscritura,
  useGuardarDatosEscribania,
  useMarcarNoAplica,
  useMarcarPaso,
  useTramiteOperacion,
} from '../../hooks/useTramite'
import type { TramitePaso } from '../../lib/api/tramite'
import { mensajeDeGuardado } from '../../lib/mensajesDeError'
import { esMoneda, MONEDA_POR_DEFECTO, MONEDAS, type Moneda } from '../../lib/moneda'
import { avisoDePostventa } from '../../lib/postventa'
import { hoyEnArgentina } from '../../lib/ritmoSemanal'
import {
  fechaInicialEscritura,
  formatearPresupuesto,
  MAX_NOMBRE_ESCRIBANIA,
  normalizarDatosEscribania,
  parsearMonto,
  PASOS_TRAMITE,
  pasosResueltos,
  textoEstadoTramite,
  type EntradaEscribania,
  type PasoTramite,
} from '../../lib/tramite'
import { useUiStore } from '../../stores/ui'

const CLASE_TARJETA = 'mb-4 rounded-[14px] border border-border bg-surface px-4 py-5 sm:px-6'

const CLASE_FECHA =
  'w-full max-w-[11rem] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.85rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)] disabled:opacity-60'

// Altura fija (34px): el select y el input miden distinto por defecto, y cuando la
// fila del presupuesto se apila se nota.
const CLASE_TEXTO =
  'h-[2.125rem] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.85rem] text-ink placeholder:text-ink-4 focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)] disabled:opacity-60 aria-[invalid=true]:border-peligro-ink'

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
            operacionId={operacionId}
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
  operacionId: string
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
  operacionId,
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

        {/* Visible siempre (también con el paso sin completar) y editable con la
            operación cerrada. Con "no aplica" se oculta, sin borrar lo cargado. */}
        {clave === 'ESCRIBANIA_ELEGIDA' && !sinAplicar && (
          <DatosEscribania operacionId={operacionId} fila={fila} deshabilitado={deshabilitado} />
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

/** Cuánto se queda el "Guardado" antes de apagarse. */
const MS_GUARDADO = 3000

/** Un monto guardado, escrito como lo escribiría una persona (se vuelve a parsear igual). */
function textoDeMonto(monto: number | null): string {
  return monto === null ? '' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(monto)
}

interface DatosEscribaniaProps {
  operacionId: string
  fila: TramitePaso | undefined
  deshabilitado: boolean
}

/**
 * El nombre de la escribanía y su presupuesto, dentro del paso "Escribanía
 * elegida". Son opcionales y se pueden cargar por separado.
 *
 * Guardar NO completa el paso: la casilla sigue siendo manual. Se guarda al
 * salir del campo (o con Enter) y solo si algo cambió; debajo hay una línea de
 * estado ("Guardando…", "Guardado", o el error).
 *
 * Cada campo guarda lo suyo junto con lo ya guardado de los demás: el nombre se
 * guarda aunque el monto que se está tipeando todavía esté mal escrito. Lo que se
 * escribe vive en un borrador (`null` = sin tocar, se ve lo guardado) que se
 * suelta al guardar.
 */
function DatosEscribania({ operacionId, fila, deshabilitado }: DatosEscribaniaProps) {
  const guardar = useGuardarDatosEscribania(operacionId)
  const idNombre = useId()
  const idMonto = useId()
  const idMoneda = useId()
  const idErrorNombre = useId()
  const idErrorMonto = useId()

  const nombreGuardado = fila?.escribania_nombre ?? null
  const montoGuardado = fila?.presupuesto_monto ?? null
  const monedaGuardada: Moneda | null = esMoneda(fila?.presupuesto_moneda)
    ? fila.presupuesto_moneda
    : null

  const [nombre, setNombre] = useState<string | null>(null)
  const [monto, setMonto] = useState<string | null>(null)
  const [moneda, setMoneda] = useState<Moneda | null>(null)
  const [errores, setErrores] = useState<{ nombre?: string; monto?: string }>({})

  const nombreActual = nombre ?? nombreGuardado ?? ''
  const montoActual = monto ?? textoDeMonto(montoGuardado)
  const monedaActual = moneda ?? monedaGuardada ?? MONEDA_POR_DEFECTO

  // El "Guardado" se apaga solo.
  const { isSuccess, reset } = guardar
  useEffect(() => {
    if (!isSuccess) return
    const id = window.setTimeout(reset, MS_GUARDADO)
    return () => window.clearTimeout(id)
  }, [isSuccess, reset])

  /** Guarda lo que cambió de `parte`, con lo ya guardado del resto. */
  function guardarParte(parte: 'nombre' | 'presupuesto', cambio: Partial<EntradaEscribania> = {}) {
    const entrada: EntradaEscribania =
      parte === 'nombre'
        ? { nombre: nombreActual, monto: montoGuardado, moneda: monedaGuardada, ...cambio }
        : {
            nombre: nombreGuardado,
            monto: montoActual,
            moneda: monedaActual,
            ...cambio,
          }

    const resultado = normalizarDatosEscribania(entrada)
    if (!resultado.ok) {
      setErrores({ nombre: resultado.errores.nombre, monto: resultado.errores.monto })
      return
    }
    setErrores({})

    const { datos } = resultado
    const sinCambios =
      datos.escribania_nombre === nombreGuardado &&
      datos.presupuesto_monto === montoGuardado &&
      datos.presupuesto_moneda === monedaGuardada
    const soltar = () => {
      if (parte === 'nombre') setNombre(null)
      else {
        setMonto(null)
        setMoneda(null)
      }
    }
    if (sinCambios) {
      soltar()
      return
    }

    guardar.mutate(datos, { onSuccess: soltar })
  }

  // El presupuesto se guarda al salir del monto, no al elegir la moneda sin monto:
  // la moneda sola no se guarda (la base la exige nula sin monto).
  function alElegirMoneda(nueva: Moneda) {
    setMoneda(nueva)
    if (montoActual.trim() !== '') guardarParte('presupuesto', { moneda: nueva })
  }

  // Enter equivale a salir del campo: una sola vía de guardado.
  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const interpretado = parsearMonto(montoActual)
  const errorMonto = errores.monto ?? (interpretado.ok ? undefined : interpretado.error)
  const hayMontoLeido = interpretado.ok && interpretado.monto !== null && !errorMonto

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <div>
        <label htmlFor={idNombre} className="text-xs font-semibold text-ink-3 uppercase">
          Escribanía
        </label>
        <input
          id={idNombre}
          type="text"
          value={nombreActual}
          maxLength={MAX_NOMBRE_ESCRIBANIA}
          placeholder="Nombre de la escribanía"
          disabled={deshabilitado}
          aria-invalid={errores.nombre ? true : undefined}
          aria-describedby={errores.nombre ? idErrorNombre : undefined}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => {
            if (nombre !== null) guardarParte('nombre')
          }}
          onKeyDown={alTeclear}
          className={`mt-1 w-full ${CLASE_TEXTO}`}
        />
        {errores.nombre && (
          <p id={idErrorNombre} role="alert" className="mt-1 mb-0 text-[0.78rem] text-peligro-ink">
            {errores.nombre}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={idMonto} className="text-xs font-semibold text-ink-3 uppercase">
          Presupuesto de la escribanía
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <select
            id={idMoneda}
            aria-label="Moneda del presupuesto"
            value={monedaActual}
            disabled={deshabilitado}
            onChange={(e) => alElegirMoneda(e.target.value === 'ARS' ? 'ARS' : 'USD')}
            className={`${CLASE_TEXTO} w-24 shrink-0`}
          >
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            id={idMonto}
            type="text"
            inputMode="decimal"
            value={montoActual}
            placeholder="Monto"
            aria-label="Monto del presupuesto de la escribanía"
            disabled={deshabilitado}
            aria-invalid={errorMonto ? true : undefined}
            aria-describedby={errorMonto ? idErrorMonto : undefined}
            onChange={(e) => {
              setMonto(e.target.value)
              setErrores((previos) => ({ ...previos, monto: undefined }))
            }}
            onBlur={() => {
              if (monto !== null) guardarParte('presupuesto')
            }}
            onKeyDown={alTeclear}
            className={`${CLASE_TEXTO} min-w-[10rem] flex-1`}
          />
        </div>
        {errorMonto && (
          <p id={idErrorMonto} role="alert" className="mt-1 mb-0 text-[0.78rem] text-peligro-ink">
            {errorMonto}
          </p>
        )}
        {hayMontoLeido && (
          <p className="mt-1 mb-0 text-[0.78rem] text-ink-3 tabular-nums">
            Se lee: {formatearPresupuesto(interpretado.monto as number, monedaActual)}
          </p>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`m-0 min-h-[1.1rem] text-[0.78rem] ${
          guardar.isError ? 'text-peligro-ink' : 'text-ink-3'
        }`}
      >
        {guardar.isPending
          ? 'Guardando…'
          : guardar.isError
            ? mensajeDeGuardado(guardar.error, 'No se pudieron guardar los datos de la escribanía.')
            : guardar.isSuccess
              ? 'Guardado'
              : ''}
      </p>
    </div>
  )
}
