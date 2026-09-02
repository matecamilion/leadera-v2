import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Campo, ErrorCampo, Input } from '../components/comunes/CampoFormulario'
import { CLASES_CONTROL, CLASES_CONTROL_SIN_ANCHO } from '../components/comunes/estilosFormulario'
import { ComboboxLead } from '../components/comunes/ComboboxLead'
import { IconoCasa } from '../components/leads/Iconos'
import { useCrearOperacion } from '../hooks/useOperaciones'
import { useCrearPropiedad } from '../hooks/usePropiedades'
import { etiquetaTipoOperacion, type TipoOperacion } from '../lib/api/operaciones'
import {
  admiteDisposicion,
  admiteExpensas,
  DISPOSICIONES,
  TIPOS_PROPIEDAD,
  type Disposicion,
  type TipoPropiedad,
} from '../lib/api/propiedades'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import {
  cantidadInvalida,
  menorACero,
  MINIMO_CANTIDAD,
  MINIMO_DESDE_CERO,
} from '../lib/validaciones'
import { useUiStore } from '../stores/ui'

const MONEDAS = ['USD', 'ARS']

/** Qué operación se crea junto con la propiedad. `NINGUNA` = sólo la propiedad. */
type OperacionAcrear = TipoOperacion | 'NINGUNA'

/**
 * Sólo VENTA y ALQUILER.
 *
 * Una COMPRA no nace del alta de una propiedad: ahí el vínculo de la operación
 * es con la búsqueda del lead —lo que alguien quiere comprar— y no con una
 * propiedad que la inmobiliaria acaba de cargar. Esa sigue estando en el alta
 * de operación, que es donde tiene el formulario de criterios.
 *
 * VENTA va primero y es el default: es el caso más común del negocio.
 */
const OPERACIONES_A_CREAR: { valor: OperacionAcrear; label: string }[] = [
  { valor: 'VENTA', label: 'Una operación de venta' },
  { valor: 'ALQUILER', label: 'Una operación de alquiler' },
  { valor: 'NINGUNA', label: 'Ninguna, sólo cargar la propiedad' },
]

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export default function NuevaPropiedad() {
  const navigate = useNavigate()
  const crear = useCrearPropiedad()
  const crearOperacion = useCrearOperacion()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  // La ficha del lead linkea acá con ?propietario=<id>: lo tomamos como valor
  // inicial del combobox, que resuelve el nombre solo. Después manda el usuario
  // y la URL no se toca. Mismo patrón que el ?estado= del listado de leads.
  const [searchParams] = useSearchParams()
  const propietarioDeLaUrl = searchParams.get('propietario')

  const [propietarioId, setPropietarioId] = useState<string | null>(propietarioDeLaUrl)
  const [direccion, setDireccion] = useState('')
  const [tipo, setTipo] = useState<TipoPropiedad>('CASA')
  const [zona, setZona] = useState('')
  const [precio, setPrecio] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [ambientes, setAmbientes] = useState('')
  const [metros, setMetros] = useState('')
  const [metrosCubiertos, setMetrosCubiertos] = useState('')
  const [banos, setBanos] = useState('')
  const [cocheras, setCocheras] = useState('')
  const [disposicion, setDisposicion] = useState<Disposicion | ''>('')
  const [expensas, setExpensas] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [linkPortal, setLinkPortal] = useState('')
  const [operacion, setOperacion] = useState<OperacionAcrear>('VENTA')
  const [tocado, setTocado] = useState(false)

  /**
   * Id de la propiedad ya creada, si el alta quedó a medias.
   *
   * Ver `manejarSubmit`: son dos escrituras sin transacción y esto evita que un
   * reintento cargue la propiedad dos veces.
   */
  const propiedadCreada = useRef<string | null>(null)

  const errorDireccion = tocado && !direccion.trim() ? 'La dirección es obligatoria' : null

  // Con una operación elegida el propietario deja de ser opcional: la
  // operación necesita a quién contactar, y sin lead su ficha nace coja. No
  // hace falta ningún alta rápida propia acá —el combobox de arriba ya trae la
  // suya, embebida en el dropdown—; alcanza con pedirlo.
  const creaOperacion = operacion !== 'NINGUNA'
  const faltaPropietario = creaOperacion && !propietarioId
  const errorPropietario =
    tocado && faltaPropietario
      ? 'Elegí el propietario —o crealo desde el mismo buscador— para poder crear la operación.'
      : null

  /** Cualquiera de las dos escrituras en curso deja el botón ocupado. */
  const guardando = crear.isPending || crearOperacion.isPending

  // Piso 1: un 0 no es "sin dato" —para eso el campo va vacío— sino un error.
  const precioInvalido = cantidadInvalida(precio)
  const ambientesInvalido = cantidadInvalida(ambientes)
  const metrosInvalido = cantidadInvalida(metros)
  const metrosCubiertosInvalido = cantidadInvalida(metrosCubiertos)
  // Piso 0 y no 1: una propiedad puede tener 0 cocheras o 0 de expensas.
  const banosInvalido = menorACero(banos)
  const cocherasInvalido = menorACero(cocheras)
  const expensasInvalido = menorACero(expensas)

  const valido =
    Boolean(direccion.trim()) &&
    !faltaPropietario &&
    !precioInvalido &&
    !ambientesInvalido &&
    !metrosInvalido &&
    !metrosCubiertosInvalido &&
    !banosInvalido &&
    !cocherasInvalido &&
    !expensasInvalido

  /**
   * Cambiar el tipo puede sacar de pantalla disposición o expensas; el valor
   * que quedaba cargado se limpia ahí mismo. Guardar un dato que el formulario
   * ya no muestra es la clase de fantasma que después nadie sabe de dónde
   * salió. Mismo criterio que el `cambiarTipo` de NuevaOperacion.
   */
  function cambiarTipo(nuevo: TipoPropiedad) {
    setTipo(nuevo)
    if (!admiteDisposicion(nuevo)) setDisposicion('')
    if (!admiteExpensas(nuevo)) setExpensas('')
  }

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido) return

    try {
      // Con una operación elegida el alta son dos escrituras sin transacción.
      // Si la segunda falla, la propiedad ya existe: se recuerda su id para que
      // reintentar cree sólo la operación y no una propiedad duplicada. Mismo
      // patrón que el alta de operación con búsqueda en `NuevaOperacion`.
      let idPropiedad = propiedadCreada.current
      if (!idPropiedad) {
        const propiedad = await crear.mutateAsync({
          direccion,
          tipo,
          // Nullable a propósito: se puede cargar una propiedad sin propietario.
          lead_propietario_id: propietarioId,
          zona,
          precio: aNumero(precio),
          moneda,
          ambientes: aNumero(ambientes),
          metros_cuadrados: aNumero(metros),
          metros_cubiertos: aNumero(metrosCubiertos),
          banos: aNumero(banos),
          cocheras: aNumero(cocheras),
          // El `|| null` va además del limpiado en `cambiarTipo`: así el
          // payload nunca depende de que el handler haya corrido.
          disposicion: admiteDisposicion(tipo) ? disposicion || null : null,
          expensas: admiteExpensas(tipo) ? aNumero(expensas) : null,
          descripcion,
          link_portal: linkPortal,
        })
        idPropiedad = propiedad.id
        propiedadCreada.current = idPropiedad
      }

      // El estado inicial no se elige acá: `crearOperacion` ya inserta todas
      // las operaciones como PUBLICADA.
      let idOperacion: string | null = null
      if (operacion !== 'NINGUNA' && propietarioId) {
        const nueva = await crearOperacion.mutateAsync({
          tipo: operacion,
          // Autogenerado con la dirección, que es como el agente reconoce la
          // operación en el listado. Se puede editar después desde su ficha.
          titulo: `${etiquetaTipoOperacion(operacion)} - ${direccion.trim()}`,
          lead_id: propietarioId,
          propiedad_id: idPropiedad,
          // El precio de la propiedad arranca como monto de la operación: es
          // el número que el agente acaba de cargar y no tiene por qué
          // retipearlo. Sin precio queda en null, que es "a definir".
          monto: aNumero(precio),
          moneda,
        })
        idOperacion = nueva.id
      }

      // El aviso va antes de navegar y sale por el store: este formulario se
      // desmonta con la navegación y no podría mostrarlo él mismo. Es el caso
      // para el que se armó el store global.
      mostrarAviso('Propiedad creada.')

      // Con operación creada el destino es su ficha: es el trabajo que el
      // agente acaba de habilitar y donde va a seguir. Sin operación se mantiene
      // el destino de siempre —si llegamos desde la ficha de un lead volvemos
      // ahí, porque la propiedad aparece en su tab; si no, al listado—.
      navigate(
        idOperacion
          ? `/operaciones/${idOperacion}`
          : propietarioDeLaUrl
            ? `/leads/${propietarioDeLaUrl}`
            : '/propiedades',
        { replace: true },
      )
    } catch {
      // El mensaje se muestra abajo con el error de la mutación que falló.
    }
  }

  return (
    <div className="mx-auto my-5 box-border w-full max-w-[800px] rounded-lg bg-surface p-6 shadow-md">
      <header className="mb-6 flex items-center gap-4">
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-brand-softer p-3 text-primary">
          <IconoCasa className="size-6" />
        </span>
        <div>
          <h1 className="m-0 text-[clamp(1.1rem,4vw,1.5rem)] font-bold text-ink">
            Nueva Propiedad
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-3">
            Cargá la propiedad y, si querés, vinculala con su propietario
          </p>
        </div>
      </header>

      <form onSubmit={manejarSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 min-[651px]:grid-cols-2 min-[651px]:gap-5">
          <Campo
            label={creaOperacion ? 'Propietario *' : 'Propietario (opcional)'}
            full
            ayuda={
              creaOperacion
                ? 'Buscá un lead existente o creá uno nuevo sin salir de acá. Hace falta para poder crear la operación.'
                : 'Buscá un lead existente o creá uno nuevo sin salir de acá. También podés dejarlo vacío.'
            }
          >
            <ComboboxLead value={propietarioId} onChange={setPropietarioId} />
            {errorPropietario && <ErrorCampo>{errorPropietario}</ErrorCampo>}
          </Campo>

          <Campo
            label="¿Qué operación creamos para esta propiedad?"
            full
            ayuda="Se crea sola al guardar, vinculada a esta propiedad y a su propietario. Te dejamos parado en su ficha."
          >
            <select
              value={operacion}
              onChange={(e) => setOperacion(e.target.value as OperacionAcrear)}
              className={CLASES_CONTROL}
            >
              {OPERACIONES_A_CREAR.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Dirección *" full>
            <Input
              value={direccion}
              onChange={setDireccion}
              placeholder="Ej: Av. Colón 1234"
              invalido={Boolean(errorDireccion)}
              required
            />
            {errorDireccion && (
              <span role="alert" className="text-xs text-peligro-ink">
                {errorDireccion}
              </span>
            )}
          </Campo>

          <Campo label="Tipo">
            <select
              value={tipo}
              onChange={(e) => cambiarTipo(e.target.value as TipoPropiedad)}
              className={CLASES_CONTROL}
            >
              {TIPOS_PROPIEDAD.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Zona">
            <Input value={zona} onChange={setZona} placeholder="Ej: Playa Grande" />
          </Campo>

          <Campo label="Precio">
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
                value={precio}
                onChange={setPrecio}
                placeholder="120000"
                invalido={precioInvalido}
              />
            </div>
            {precioInvalido && <ErrorCampo>El precio tiene que ser 1 o más.</ErrorCampo>}
          </Campo>

          <Campo label="Ambientes">
            <Input
              type="number"
              min={MINIMO_CANTIDAD}
              value={ambientes}
              onChange={setAmbientes}
              placeholder="3"
              invalido={ambientesInvalido}
            />
            {ambientesInvalido && (
              <ErrorCampo>La cantidad de ambientes tiene que ser 1 o más.</ErrorCampo>
            )}
          </Campo>

          {/* El label dice "Metros totales"; la columna sigue siendo
              `metros_cuadrados` en la base y en el resto del código. */}
          <Campo label="Metros totales">
            <Input
              type="number"
              min={MINIMO_CANTIDAD}
              value={metros}
              onChange={setMetros}
              placeholder="85"
              invalido={metrosInvalido}
            />
            {metrosInvalido && (
              <ErrorCampo>Los metros totales tienen que ser 1 o más.</ErrorCampo>
            )}
          </Campo>

          <Campo label="Metros cubiertos">
            <Input
              type="number"
              min={MINIMO_CANTIDAD}
              value={metrosCubiertos}
              onChange={setMetrosCubiertos}
              placeholder="70"
              invalido={metrosCubiertosInvalido}
            />
            {metrosCubiertosInvalido && (
              <ErrorCampo>Los metros cubiertos tienen que ser 1 o más.</ErrorCampo>
            )}
          </Campo>

          <Campo label="Baños">
            <Input
              type="number"
              min={MINIMO_DESDE_CERO}
              value={banos}
              onChange={setBanos}
              placeholder="2"
              invalido={banosInvalido}
            />
            {banosInvalido && <ErrorCampo>Los baños no pueden ser negativos.</ErrorCampo>}
          </Campo>

          <Campo label="Cocheras">
            <Input
              type="number"
              min={MINIMO_DESDE_CERO}
              value={cocheras}
              onChange={setCocheras}
              placeholder="1"
              invalido={cocherasInvalido}
            />
            {cocherasInvalido && (
              <ErrorCampo>Las cocheras no pueden ser negativas.</ErrorCampo>
            )}
          </Campo>

          {admiteDisposicion(tipo) && (
            <Campo label="Disposición">
              <select
                value={disposicion}
                onChange={(e) => setDisposicion(e.target.value as Disposicion | '')}
                className={CLASES_CONTROL}
              >
                <option value="">No especifica</option>
                {DISPOSICIONES.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {/* Sin selector de moneda: el de arriba es la moneda del precio, y
              las expensas casi nunca van en la misma. No hay columna aparte
              para eso, así que el campo va pelado. */}
          {admiteExpensas(tipo) && (
            <Campo label="Expensas (mensual)">
              <Input
                type="number"
                min={MINIMO_DESDE_CERO}
                value={expensas}
                onChange={setExpensas}
                placeholder="45000"
                invalido={expensasInvalido}
              />
              {expensasInvalido && (
                <ErrorCampo>Las expensas no pueden ser negativas.</ErrorCampo>
              )}
            </Campo>
          )}

          <Campo label="Link de la publicación">
            <Input
              type="url"
              value={linkPortal}
              onChange={setLinkPortal}
              placeholder="https://..."
            />
          </Campo>

          <Campo label="Descripción" full>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Pileta, parrilla, cochera para dos autos..."
              className={`${CLASES_CONTROL} min-h-20 resize-y leading-normal`}
            />
          </Campo>
        </div>

        {(crear.isError || crearOperacion.isError) && (
          <div role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            <p className="m-0">
              {mensajeDeGuardado(
                crear.error ?? crearOperacion.error,
                'No se pudo crear la propiedad.',
              )}
            </p>

            {/* Falló la segunda escritura: hay que decir que la primera quedó
                hecha, o el agente vuelve a cargar la propiedad entera creyendo
                que se perdió todo. */}
            {crear.isSuccess && crearOperacion.isError && (
              <p className="mt-1 text-ink-3">
                La propiedad ya quedó guardada. Al reintentar se crea sólo la
                operación.
              </p>
            )}
          </div>
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
            disabled={!valido || guardando}
            className="rounded-md border-none bg-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {guardando
              ? 'Creando…'
              : // Reintento con la propiedad ya creada: decir "Crear propiedad"
                // ahí sería mentirle al agente sobre lo que falta.
                crear.isSuccess && creaOperacion
                ? 'Crear operación'
                : creaOperacion
                  ? 'Crear propiedad y operación'
                  : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  )
}
