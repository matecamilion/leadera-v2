import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Campo, ErrorCampo, Input } from '../comunes/CampoFormulario'
import { ComboboxLead } from '../comunes/ComboboxLead'
import { ComboboxPropiedad } from '../comunes/ComboboxPropiedad'
import { CLASES_CONTROL, CLASES_CONTROL_SIN_ANCHO } from '../comunes/estilosFormulario'
import { FormularioBusqueda } from './FormularioBusqueda'
import { useBusquedasDeLead } from '../../hooks/useOperaciones'
import { useCriteriosBusqueda } from '../../hooks/useBusqueda'
import { etiquetaTipo } from '../../lib/api/propiedades'
import {
  cantidadInvalida,
  excedeTope,
  MENSAJE_VALOR_ALTO,
  MINIMO_CANTIDAD,
  TOPE_PRECIO,
} from '../../lib/validaciones'
import {
  CRITERIOS_VACIOS,
  hayAlgunCriterio,
  type CriteriosBusqueda,
} from '../../lib/api/busquedas'
import {
  llevaCriteriosDeBusqueda,
  TIPOS_OPERACION,
  type CamposEditablesOperacion,
  type OperacionDetalle,
  type TipoOperacion,
  seVinculaConBusqueda,
} from '../../lib/api/operaciones'

const MONEDAS = ['USD', 'ARS']

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

interface ModalEditarOperacionProps {
  abierto: boolean
  operacion: OperacionDetalle
  guardando: boolean
  error?: string | null
  onCerrar: () => void
  /**
   * `criterios` viene sólo si la operación quedó como COMPRA, hay lead y se
   * cargó algo. `null` significa "no toques la búsqueda": la página no la crea
   * ni la borra, sólo guarda los campos de la operación.
   */
  onGuardar: (
    campos: CamposEditablesOperacion,
    criterios: CriteriosBusqueda | null,
  ) => void
}

/**
 * Edición de los datos de la ficha. Mismos campos que el alta, menos el estado.
 *
 * Los controles salen de `CampoFormulario` y `estilosFormulario`, no de copias
 * locales: así este formulario y el de alta se ven igual y cambian juntos.
 * Como efecto lateral queda con controles más grandes que
 * `ModalEditarPropiedad`, que sí tiene sus propias copias.
 *
 * El piso del monto es 1, el mismo que el alta. La base acepta el 0 —su
 * constraint sólo rechaza negativos—, pero eso convertía a esta pantalla en la
 * puerta de atrás para dejar en cero un monto que el alta no deja cargar así:
 * una operación cerrada en 0 pasa por las métricas de plata sin sumar nada y
 * sin avisar que le falta el dato. Vacío sigue siendo válido: es "a definir".
 */
export function ModalEditarOperacion({
  abierto,
  operacion,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: ModalEditarOperacionProps) {
  const ref = useRef<HTMLDialogElement>(null)

  const [tipo, setTipo] = useState<TipoOperacion>(operacion.tipo)
  const [titulo, setTitulo] = useState(operacion.titulo ?? '')
  const [leadId, setLeadId] = useState<string | null>(operacion.lead_id)
  const [propiedadId, setPropiedadId] = useState<string | null>(operacion.propiedad_id)
  const [busquedaId, setBusquedaId] = useState<string | null>(operacion.busqueda_id)
  const [monto, setMonto] = useState(operacion.monto?.toString() ?? '')
  const [moneda, setMoneda] = useState(operacion.moneda)
  const [notas, setNotas] = useState(operacion.notas ?? '')
  const [tocado, setTocado] = useState(false)
  const [criterios, setCriterios] = useState<CriteriosBusqueda>(CRITERIOS_VACIOS)

  // Ver `NuevaOperacion`: `vinculaBusqueda` es el vínculo, `llevaCriterios` es el
  // formulario de criterios. Ver `seVinculaConBusqueda` en la capa de API.
  const vinculaBusqueda = seVinculaConBusqueda(tipo)
  const llevaCriterios = llevaCriteriosDeBusqueda(tipo)

  const { data: busquedas, isFetching: buscandoBusquedas } = useBusquedasDeLead(
    vinculaBusqueda ? leadId : null,
  )

  // Los criterios de la búsqueda vinculada. Se precargan una sola vez por
  // búsqueda: después manda lo que el usuario esté tipeando.
  const { data: criteriosGuardados } = useCriteriosBusqueda(
    llevaCriterios ? busquedaId : null,
  )
  /** Qué búsqueda refleja el borrador actual. `null` = formulario vacío. */
  const [busquedaEnBorrador, setBusquedaEnBorrador] = useState<string | null>(null)

  /*
   * Sincronización de los criterios con la búsqueda vinculada.
   *
   * Va durante el render y no en un efecto —es el patrón de React para ajustar
   * estado cuando cambian las props—: un efecto commitearía primero el
   * formulario vacío y recién después el precargado, con el parpadeo a la
   * vista. Los `!==` cortan la recursión.
   *
   * Al cerrar se vuelve a cero, así una edición cancelada no reaparece la
   * próxima vez que se abra el modal.
   */
  if (!abierto) {
    if (busquedaEnBorrador !== null) {
      setBusquedaEnBorrador(null)
      setCriterios(CRITERIOS_VACIOS)
    }
  } else if (!busquedaId) {
    if (busquedaEnBorrador !== null) {
      setBusquedaEnBorrador(null)
      setCriterios(CRITERIOS_VACIOS)
    }
  } else if (criteriosGuardados && busquedaEnBorrador !== busquedaId) {
    // Mientras `criteriosGuardados` no llegó no se toca nada: el formulario
    // queda vacío un instante y se completa cuando responde la query.
    setBusquedaEnBorrador(busquedaId)
    setCriterios(criteriosGuardados)
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) {
      // Al abrir partimos siempre de los datos actuales: si el usuario canceló
      // una edición anterior, no queremos ver su borrador.
      setTipo(operacion.tipo)
      setTitulo(operacion.titulo ?? '')
      setLeadId(operacion.lead_id)
      setPropiedadId(operacion.propiedad_id)
      setBusquedaId(operacion.busqueda_id)
      setMonto(operacion.monto?.toString() ?? '')
      setMoneda(operacion.moneda)
      setNotas(operacion.notas ?? '')
      setTocado(false)
      // Los criterios NO se resetean acá: los maneja el efecto de arriba, que
      // depende de `abierto` justamente para poder repoblarlos al reabrir.
      dialog.showModal()
    }
    if (!abierto && dialog.open) dialog.close()
  }, [abierto, operacion])

  const errorTitulo = tocado && !titulo.trim() ? 'El título es obligatorio' : null
  const montoInvalido = cantidadInvalida(monto)
  const montoAlto = excedeTope(monto, TOPE_PRECIO)
  const valido = Boolean(titulo.trim()) && !montoInvalido && !montoAlto

  function cambiarTipo(nuevo: TipoOperacion) {
    setTipo(nuevo)
    // El vínculo que deja de aplicar se limpia: guardar una propiedad en una
    // operación de COMPRA (o al revés) dejaría datos que la UI ya no muestra.
    if (nuevo === 'COMPRA') setPropiedadId(null)
    else setBusquedaId(null)
  }

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido) return

    onGuardar(
      {
        tipo,
        titulo: titulo.trim(),
        lead_id: leadId,
        propiedad_id: vinculaBusqueda ? null : propiedadId,
        busqueda_id: vinculaBusqueda ? busquedaId : null,
        monto: aNumero(monto),
        moneda,
        notas: notas.trim() || null,
      },
      // Sin lead no se puede guardar una búsqueda (`lead_id` es NOT NULL), y
      // con el formulario vacío no hay nada que guardar.
      llevaCriterios && leadId && hayAlgunCriterio(criterios) ? criterios : null,
    )
  }

  return (
    <dialog
      ref={ref}
      aria-label="Editar la operación"
      // El Escape del <dialog> cierra sin avisar al padre: lo interceptamos
      // para que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[620px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-5 text-center text-lg font-bold text-ink">Editar operación</h3>

        <div className="grid grid-cols-1 gap-4 min-[651px]:grid-cols-2 min-[651px]:gap-5">
          <Campo label="Tipo *">
            <select
              value={tipo}
              onChange={(e) => cambiarTipo(e.target.value as TipoOperacion)}
              className={CLASES_CONTROL}
            >
              {TIPOS_OPERACION.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Título *">
            <Input
              value={titulo}
              onChange={setTitulo}
              placeholder="Ej: Venta depto Alvear 1890"
              invalido={Boolean(errorTitulo)}
              required
            />
            {errorTitulo && <ErrorCampo>{errorTitulo}</ErrorCampo>}
          </Campo>

          <Campo label="Lead (opcional)" full>
            <ComboboxLead value={leadId} onChange={setLeadId} />
          </Campo>

          {/* Quien ofrece (VENTA, ALQUILER) se apoya en una propiedad; quien
              busca (COMPRA, BUSQUEDA_ALQUILER), en una
              búsqueda del lead. Ninguno es obligatorio. */}
          {!vinculaBusqueda ? (
            <Campo label="Propiedad (opcional)" full>
              <ComboboxPropiedad value={propiedadId} onChange={setPropiedadId} />
            </Campo>
          ) : (
            <Campo
              label="Búsqueda del lead (opcional)"
              full
              ayuda={
                leadId
                  ? 'Sólo se listan las búsquedas activas del lead elegido.'
                  : 'Elegí primero un lead para ver sus búsquedas.'
              }
            >
              <select
                value={busquedaId ?? ''}
                onChange={(e) => setBusquedaId(e.target.value || null)}
                disabled={!leadId || buscandoBusquedas}
                className={`${CLASES_CONTROL} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">
                  {!leadId
                    ? 'Sin lead seleccionado'
                    : buscandoBusquedas
                      ? 'Cargando…'
                      : busquedas?.length
                        ? 'Sin vincular'
                        : 'Este lead no tiene búsquedas activas'}
                </option>
                {busquedas?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.tipo_propiedad ? etiquetaTipo(b.tipo_propiedad) : 'Cualquier tipo'}
                    {b.zona ? ` en ${b.zona}` : ''}
                    {b.precio_max != null ? ` · hasta ${b.precio_max}` : ''}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <Campo label="Monto">
            <div className="flex gap-2">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                aria-label="Moneda"
                className={`${CLASES_CONTROL_SIN_ANCHO} w-24 shrink-0`}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={MINIMO_CANTIDAD}
                value={monto}
                onChange={setMonto}
                placeholder="120000"
                invalido={montoInvalido || montoAlto}
              />
            </div>
            {montoInvalido && <ErrorCampo>El monto tiene que ser 1 o más.</ErrorCampo>}
            {montoAlto && <ErrorCampo>{MENSAJE_VALOR_ALTO}</ErrorCampo>}
          </Campo>

          <Campo label="Notas" full>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Contexto de la operación, condiciones acordadas..."
              className={`${CLASES_CONTROL} min-h-20 resize-y leading-normal`}
            />
          </Campo>
        </div>

        {llevaCriterios && (
          <FormularioBusqueda
            criterios={criterios}
            onCambiar={setCriterios}
            deshabilitado={!leadId}
          />
        )}

        {error && (
          <p role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold text-ink-3 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || guardando}
            className="flex-1 rounded-lg border-none bg-primary px-4 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
