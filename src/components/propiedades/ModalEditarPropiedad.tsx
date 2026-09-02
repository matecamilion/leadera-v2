import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ComboboxLead } from '../comunes/ComboboxLead'
import {
  admiteDisposicion,
  admiteExpensas,
  DISPOSICIONES,
  TIPOS_PROPIEDAD,
  type CamposEditables,
  type Disposicion,
  type PropiedadDetalle,
  type TipoPropiedad,
} from '../../lib/api/propiedades'
import {
  cantidadInvalida,
  menorACero,
  MINIMO_CANTIDAD,
  MINIMO_DESDE_CERO,
} from '../../lib/validaciones'

const MONEDAS = ['USD', 'ARS']

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

interface ModalEditarPropiedadProps {
  abierto: boolean
  propiedad: PropiedadDetalle
  guardando: boolean
  error?: string | null
  onCerrar: () => void
  onGuardar: (campos: CamposEditables) => void
}

export function ModalEditarPropiedad({
  abierto,
  propiedad,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: ModalEditarPropiedadProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [direccion, setDireccion] = useState(propiedad.direccion)
  const [tipo, setTipo] = useState<TipoPropiedad>(propiedad.tipo)
  const [zona, setZona] = useState(propiedad.zona ?? '')
  const [precio, setPrecio] = useState(propiedad.precio?.toString() ?? '')
  const [moneda, setMoneda] = useState(propiedad.moneda)
  const [ambientes, setAmbientes] = useState(propiedad.ambientes?.toString() ?? '')
  const [metros, setMetros] = useState(propiedad.metros_cuadrados?.toString() ?? '')
  const [metrosCubiertos, setMetrosCubiertos] = useState(
    propiedad.metros_cubiertos?.toString() ?? '',
  )
  const [banos, setBanos] = useState(propiedad.banos?.toString() ?? '')
  const [cocheras, setCocheras] = useState(propiedad.cocheras?.toString() ?? '')
  const [disposicion, setDisposicion] = useState<Disposicion | ''>(
    propiedad.disposicion ?? '',
  )
  const [expensas, setExpensas] = useState(propiedad.expensas?.toString() ?? '')
  const [descripcion, setDescripcion] = useState(propiedad.descripcion ?? '')
  const [linkPortal, setLinkPortal] = useState(propiedad.link_portal ?? '')
  const [propietarioId, setPropietarioId] = useState(propiedad.lead_propietario_id)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) {
      // Al abrir, partimos siempre de los datos actuales de la propiedad.
      setDireccion(propiedad.direccion)
      setTipo(propiedad.tipo)
      setZona(propiedad.zona ?? '')
      setPrecio(propiedad.precio?.toString() ?? '')
      setMoneda(propiedad.moneda)
      setAmbientes(propiedad.ambientes?.toString() ?? '')
      setMetros(propiedad.metros_cuadrados?.toString() ?? '')
      setMetrosCubiertos(propiedad.metros_cubiertos?.toString() ?? '')
      setBanos(propiedad.banos?.toString() ?? '')
      setCocheras(propiedad.cocheras?.toString() ?? '')
      setDisposicion(propiedad.disposicion ?? '')
      setExpensas(propiedad.expensas?.toString() ?? '')
      setDescripcion(propiedad.descripcion ?? '')
      setLinkPortal(propiedad.link_portal ?? '')
      setPropietarioId(propiedad.lead_propietario_id)
      setErrorLocal(null)
      dialog.showModal()
    }
    if (!abierto && dialog.open) dialog.close()
  }, [abierto, propiedad])

  /**
   * Cambiar el tipo puede sacar de pantalla disposición o expensas; el valor
   * que quedaba cargado se limpia ahí mismo, para no reenviar al guardar un
   * dato que el formulario ya no muestra.
   */
  function cambiarTipo(nuevo: TipoPropiedad) {
    setTipo(nuevo)
    if (!admiteDisposicion(nuevo)) setDisposicion('')
    if (!admiteExpensas(nuevo)) setExpensas('')
  }

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    if (!direccion.trim()) {
      setErrorLocal('La dirección es obligatoria.')
      return
    }
    // Piso 1 en los tres numéricos: el 0 se cargaba sin que nada lo frenara,
    // ni acá ni en el alta.
    if (cantidadInvalida(precio)) {
      setErrorLocal('El precio tiene que ser 1 o más.')
      return
    }
    if (cantidadInvalida(ambientes)) {
      setErrorLocal('La cantidad de ambientes tiene que ser 1 o más.')
      return
    }
    if (cantidadInvalida(metros)) {
      setErrorLocal('Los metros totales tienen que ser 1 o más.')
      return
    }
    if (cantidadInvalida(metrosCubiertos)) {
      setErrorLocal('Los metros cubiertos tienen que ser 1 o más.')
      return
    }
    // Piso 0 y no 1: una propiedad puede tener 0 cocheras o 0 de expensas.
    if (menorACero(banos)) {
      setErrorLocal('Los baños no pueden ser negativos.')
      return
    }
    if (menorACero(cocheras)) {
      setErrorLocal('Las cocheras no pueden ser negativas.')
      return
    }
    if (menorACero(expensas)) {
      setErrorLocal('Las expensas no pueden ser negativas.')
      return
    }
    setErrorLocal(null)
    onGuardar({
      direccion: direccion.trim(),
      tipo,
      zona: zona.trim() || null,
      precio: aNumero(precio),
      moneda,
      ambientes: aNumero(ambientes),
      metros_cuadrados: aNumero(metros),
      metros_cubiertos: aNumero(metrosCubiertos),
      banos: aNumero(banos),
      cocheras: aNumero(cocheras),
      // El chequeo del tipo va además del limpiado en `cambiarTipo`: normaliza
      // también las filas viejas que quedaron con un valor que su tipo no
      // admite, cargadas antes de que esta regla existiera.
      disposicion: admiteDisposicion(tipo) ? disposicion || null : null,
      expensas: admiteExpensas(tipo) ? aNumero(expensas) : null,
      descripcion: descripcion.trim() || null,
      link_portal: linkPortal.trim() || null,
      lead_propietario_id: propietarioId,
    })
  }

  return (
    <dialog
      ref={ref}
      aria-label="Editar la propiedad"
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[560px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-5 text-center text-lg font-bold text-ink">Editar propiedad</h3>

        <Campo label="Propietario">
          <ComboboxLead value={propietarioId} onChange={setPropietarioId} />
        </Campo>

        <Campo label="Dirección *">
          <Entrada valor={direccion} onCambiar={setDireccion} placeholder="Av. Colón 1234" />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Tipo">
            <select
              value={tipo}
              onChange={(e) => cambiarTipo(e.target.value as TipoPropiedad)}
              className={CLASES}
            >
              {TIPOS_PROPIEDAD.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Zona">
            <Entrada valor={zona} onCambiar={setZona} placeholder="Playa Grande" />
          </Campo>

          <Campo label="Moneda">
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className={CLASES}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Precio">
            <Entrada valor={precio} onCambiar={setPrecio} tipo="number" min={MINIMO_CANTIDAD} placeholder="120000" />
          </Campo>

          <Campo label="Ambientes">
            <Entrada valor={ambientes} onCambiar={setAmbientes} tipo="number" min={MINIMO_CANTIDAD} placeholder="3" />
          </Campo>

          {/* El label dice "Metros totales"; la columna sigue siendo
              `metros_cuadrados` en la base y en el resto del código. */}
          <Campo label="Metros totales">
            <Entrada valor={metros} onCambiar={setMetros} tipo="number" min={MINIMO_CANTIDAD} placeholder="85" />
          </Campo>

          <Campo label="Metros cubiertos">
            <Entrada
              valor={metrosCubiertos}
              onCambiar={setMetrosCubiertos}
              tipo="number"
              min={MINIMO_CANTIDAD}
              placeholder="70"
            />
          </Campo>

          <Campo label="Baños">
            <Entrada valor={banos} onCambiar={setBanos} tipo="number" min={MINIMO_DESDE_CERO} placeholder="2" />
          </Campo>

          <Campo label="Cocheras">
            <Entrada valor={cocheras} onCambiar={setCocheras} tipo="number" min={MINIMO_DESDE_CERO} placeholder="1" />
          </Campo>

          {admiteDisposicion(tipo) && (
            <Campo label="Disposición">
              <select
                value={disposicion}
                onChange={(e) => setDisposicion(e.target.value as Disposicion | '')}
                className={CLASES}
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

          {/* Sin selector de moneda: el de arriba es la del precio, y las
              expensas casi nunca van en la misma. */}
          {admiteExpensas(tipo) && (
            <Campo label="Expensas (mensual)">
              <Entrada valor={expensas} onCambiar={setExpensas} tipo="number" min={MINIMO_DESDE_CERO} placeholder="45000" />
            </Campo>
          )}
        </div>

        <Campo label="Link de la publicación">
          <Entrada
            valor={linkPortal}
            onCambiar={setLinkPortal}
            tipo="url"
            placeholder="https://..."
          />
        </Campo>

        <Campo label="Descripción">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            maxLength={500}
            className={`${CLASES} min-h-[70px] resize-y`}
          />
        </Campo>

        {(errorLocal || error) && (
          <p role="alert" className="m-0 text-[0.85rem] text-peligro-ink">
            {errorLocal ?? error}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-caliente bg-transparent px-4 py-2.5 font-semibold text-caliente transition-colors hover:bg-hot-soft disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 rounded-lg border-none bg-primary px-4 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

const CLASES =
  'w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors outline-none focus:border-primary motion-reduce:transition-none'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 flex flex-col gap-1.5 text-left">
      <span className="text-[0.85rem] font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  )
}

function Entrada({
  valor,
  onCambiar,
  tipo = 'text',
  placeholder,
  min,
}: {
  valor: string
  onCambiar: (v: string) => void
  tipo?: string
  placeholder?: string
  /** Sólo para los numéricos. */
  min?: number
}) {
  return (
    <input
      type={tipo}
      value={valor}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onCambiar(e.target.value)}
      className={CLASES}
    />
  )
}
