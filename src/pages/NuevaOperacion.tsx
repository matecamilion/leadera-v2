import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Campo, ErrorCampo, Input } from '../components/comunes/CampoFormulario'
import { ComboboxLead } from '../components/comunes/ComboboxLead'
import { ComboboxPropiedad } from '../components/comunes/ComboboxPropiedad'
import { CLASES_CONTROL, CLASES_CONTROL_SIN_ANCHO } from '../components/comunes/estilosFormulario'
import { FormularioBusqueda } from '../components/operaciones/FormularioBusqueda'
import { IconoCajas } from '../components/leads/Iconos'
import { useBusquedasDeLead, useCrearOperacion } from '../hooks/useOperaciones'
import { useCriteriosBusqueda, useGuardarBusqueda } from '../hooks/useBusqueda'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import { useUiStore } from '../stores/ui'
import { cantidadInvalida, MINIMO_CANTIDAD } from '../lib/validaciones'
import {
  llevaCriteriosDeBusqueda,
  TIPOS_OPERACION,
  type TipoOperacion,
} from '../lib/api/operaciones'
import {
  CRITERIOS_VACIOS,
  hayAlgunCriterio,
  type CriteriosBusqueda,
} from '../lib/api/busquedas'
import { etiquetaTipo } from '../lib/api/propiedades'

const MONEDAS = ['USD', 'ARS']

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export default function NuevaOperacion() {
  const navigate = useNavigate()
  const crear = useCrearOperacion()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  // La ficha del lead linkea acá con ?lead=<id>: lo tomamos como valor inicial
  // del combobox, que resuelve el nombre solo. Después manda el usuario y la
  // URL no se toca. Mismo patrón que el ?estado= del listado de leads.
  const [searchParams] = useSearchParams()
  const leadDeLaUrl = searchParams.get('lead')

  const [tipo, setTipo] = useState<TipoOperacion>('VENTA')
  const [titulo, setTitulo] = useState('')
  const [leadId, setLeadId] = useState<string | null>(leadDeLaUrl)
  const [propiedadId, setPropiedadId] = useState<string | null>(null)
  const [busquedaId, setBusquedaId] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [notas, setNotas] = useState('')
  const [tocado, setTocado] = useState(false)
  const [criterios, setCriterios] = useState<CriteriosBusqueda>(CRITERIOS_VACIOS)

  // Dos banderas distintas a propósito: `esCompra` decide CON QUÉ se vincula la
  // operación (búsqueda o propiedad) y `llevaCriterios` decide si se cargan
  // criterios. ALQUILER cae de un lado en una y del otro en la otra.
  const esCompra = tipo === 'COMPRA'
  const llevaCriterios = llevaCriteriosDeBusqueda(tipo)

  const { data: busquedas, isFetching: buscandoBusquedas } = useBusquedasDeLead(
    esCompra ? leadId : null,
  )
  const guardarCriterios = useGuardarBusqueda()

  // Si elige una búsqueda que ya existe, el formulario se precarga con sus
  // criterios: guardar la actualiza en vez de crear una nueva, y sin precargar
  // los campos vacíos le borrarían lo que el lead ya tenía cargado.
  const { data: criteriosGuardados } = useCriteriosBusqueda(
    llevaCriterios ? busquedaId : null,
  )
  const busquedaPrecargada = useRef<string | null>(null)
  /** Id de la operación ya creada, si el alta quedó a medias. Ver `manejarSubmit`. */
  const operacionCreada = useRef<string | null>(null)

  useEffect(() => {
    if (!busquedaId) {
      // Volvió a "sin vincular": se limpia para que lo próximo sea un alta.
      if (busquedaPrecargada.current !== null) {
        busquedaPrecargada.current = null
        setCriterios(CRITERIOS_VACIOS)
      }
      return
    }
    // Sólo la primera vez por búsqueda: después manda lo que el usuario tipeó.
    if (criteriosGuardados && busquedaPrecargada.current !== busquedaId) {
      busquedaPrecargada.current = busquedaId
      setCriterios(criteriosGuardados)
    }
  }, [busquedaId, criteriosGuardados])

  const errorTitulo = tocado && !titulo.trim() ? 'El título es obligatorio' : null
  // Piso 1: un monto en 0 resta credibilidad a la métrica de cerrado del mes.
  const montoInvalido = cantidadInvalida(monto)
  const valido = Boolean(titulo.trim()) && !montoInvalido

  function cambiarTipo(nuevo: TipoOperacion) {
    setTipo(nuevo)
    // El vínculo que deja de aplicar se limpia: guardar una propiedad en una
    // operación de COMPRA (o al revés) dejaría datos que la UI ya no muestra.
    if (nuevo === 'COMPRA') setPropiedadId(null)
    else setBusquedaId(null)
  }

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido) return

    try {
      // El alta son dos escrituras sin transacción. Si la segunda falla, la
      // operación ya existe: se recuerda su id para que reintentar retome
      // desde los criterios en vez de crear una operación duplicada.
      let idOperacion = operacionCreada.current
      if (!idOperacion) {
        const operacion = await crear.mutateAsync({
          tipo,
          titulo,
          lead_id: leadId,
          propiedad_id: esCompra ? null : propiedadId,
          busqueda_id: esCompra ? busquedaId : null,
          monto: aNumero(monto),
          moneda,
          notas,
        })
        idOperacion = operacion.id
        operacionCreada.current = idOperacion
      }

      // Los criterios van después: necesitan el id de la operación recién
      // creada. Sólo si es COMPRA, hay lead —`busquedas.lead_id` es NOT NULL—
      // y cargó algo; un formulario vacío no crea una búsqueda en blanco.
      const guardoCriterios =
        llevaCriterios && leadId !== null && hayAlgunCriterio(criterios)

      if (guardoCriterios) {
        await guardarCriterios.mutateAsync({
          operacionId: idOperacion,
          leadId,
          criterios,
        })
      }

      // Con criterios cargados el destino es la ficha de la operación: ahí está
      // la sección de coincidencias, que es lo que el agente acaba de habilitar
      // y el motivo por el que se tomó el trabajo de cargarlos.
      //
      // Sin criterios se mantiene el destino de siempre: si llegamos desde la
      // ficha de un lead volvemos ahí, porque terminar el alta en el listado
      // general dejaría al usuario lejos de donde arrancó.
      const destino = guardoCriterios
        ? `/operaciones/${idOperacion}`
        : leadDeLaUrl
          ? `/leads/${leadDeLaUrl}`
          : '/operaciones'

      // Antes de navegar y por el store: el formulario se desmonta con la
      // navegación y no podría mostrar el aviso él mismo. Vale para los tres
      // destinos posibles, incluida la ficha de la operación cuando se
      // cargaron criterios.
      mostrarAviso('Operación creada.')
      navigate(destino, { replace: true })
    } catch {
      // El mensaje se muestra abajo con crear.error.
    }
  }

  return (
    <div className="mx-auto my-5 box-border w-full max-w-[800px] rounded-lg bg-surface p-6 shadow-md">
      <header className="mb-6 flex items-center gap-4">
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-brand-softer p-3 text-primary">
          <IconoCajas className="size-6" />
        </span>
        <div>
          <h1 className="m-0 text-[clamp(1.1rem,4vw,1.5rem)] font-bold text-ink">
            Nueva Operación
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-3">
            Cargala ahora y vinculá el lead, la propiedad o la búsqueda cuando quieras
          </p>
        </div>
      </header>

      <form onSubmit={manejarSubmit} noValidate>
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
            {errorTitulo && (
              <span role="alert" className="text-xs text-peligro-ink">
                {errorTitulo}
              </span>
            )}
          </Campo>

          <Campo
            label="Lead (opcional)"
            full
            ayuda="Buscá un lead existente o creá uno nuevo sin salir de acá."
          >
            <ComboboxLead value={leadId} onChange={setLeadId} />
          </Campo>

          {/* VENTA y ALQUILER se apoyan en una propiedad; COMPRA en una
              búsqueda del lead. Ninguno es obligatorio. */}
          {!esCompra ? (
            <Campo
              label="Propiedad (opcional)"
              full
              ayuda="Si todavía no está cargada, podés vincularla más adelante."
            >
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
                invalido={montoInvalido}
              />
            </div>
            {montoInvalido && <ErrorCampo>El monto tiene que ser 1 o más.</ErrorCampo>}
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

        {/* Criterios en COMPRA y en ALQUILER: en las dos el lead está buscando
            algo. En VENTA no, porque ahí la propiedad la pone la inmobiliaria.
            El RPC filtra los candidatos por finalidad según el tipo, así que
            una búsqueda de alquiler no propone propiedades sólo en venta. */}
        {llevaCriterios && (
          <FormularioBusqueda
            criterios={criterios}
            onCambiar={setCriterios}
            deshabilitado={!leadId}
          />
        )}

        {crear.isError && (
          <p role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            {mensajeDeGuardado(crear.error, 'No se pudo crear la operación.')}
          </p>
        )}

        {/* La operación ya quedó creada si falla esto: hay que decirlo, o el
            usuario reintenta el alta entera y la duplica. */}
        {guardarCriterios.isError && (
          <p role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            La operación se creó, pero no se pudieron guardar los criterios de
            búsqueda:{' '}
            {mensajeDeGuardado(guardarCriterios.error, 'error desconocido.')} Podés
            cargarlos desde la ficha de la operación.
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 min-[481px]:flex-row min-[481px]:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-border bg-surface px-6 py-3 font-semibold text-ink-3 transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || crear.isPending || guardarCriterios.isPending}
            className="rounded-md border-none bg-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {crear.isPending || guardarCriterios.isPending
              ? 'Creando…'
              : 'Crear operación'}
          </button>
        </div>
      </form>
    </div>
  )
}
