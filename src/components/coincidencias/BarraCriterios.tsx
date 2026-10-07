import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { hayCriterioDeOferta, type CriteriosOferta } from '../../lib/api/busquedas'
import { TIPOS_PROPIEDAD, type TipoPropiedad } from '../../lib/api/propiedades'
import { AMBIENTES_TOPE, contarCriterios } from '../../lib/ofertaEnUrl'

/**
 * Altura y look de todos los controles de la barra: 40px, como los botones del
 * listado de leads. El ancho va aparte por lo mismo que en `estilosFormulario`:
 * `w-full` no se puede pisar desde otra clase de ancho.
 */
const CONTROL_SIN_ANCHO =
  'h-10 rounded-lg border border-border bg-surface px-3 text-[0.9rem] text-ink placeholder:text-ink-3 transition-colors focus:border-primary focus:outline-none motion-reduce:transition-none'
const CONTROL = `w-full ${CONTROL_SIN_ANCHO}`

/** Botón de un control segmentado (operación, ambientes). */
function claseOpcion(activa: boolean): string {
  return [
    'flex-1 rounded-md px-2.5 text-[0.85rem] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
    activa ? 'bg-primary text-primary-contrast' : 'text-ink-3 hover:bg-surface hover:text-ink',
  ].join(' ')
}

/** Contenedor de un control segmentado: mide lo mismo que un input. */
const SEGMENTADO = 'flex h-10 gap-0.5 rounded-lg border border-border bg-background p-0.5'

const OPERACIONES: { valor: 'COMPRA' | 'ALQUILER'; label: string }[] = [
  { valor: 'COMPRA', label: 'Compra' },
  { valor: 'ALQUILER', label: 'Alquiler' },
]

const AMBIENTES = Array.from({ length: AMBIENTES_TOPE }, (_, i) => i + 1)

/** Los números se guardan como texto de dígitos: así el input puede mostrar 250.000. */
interface Borrador {
  tipoOperacion: 'COMPRA' | 'ALQUILER'
  precio: string
  moneda: 'USD' | 'ARS'
  tipoPropiedad: TipoPropiedad | ''
  zona: string
  ambientes: number | null
  m2: string
  banos: string
  cocheras: string
  expensas: string
}

const aTexto = (n: number | null) => (n == null ? '' : String(Math.trunc(n)))

function desdeCriterios(c: CriteriosOferta): Borrador {
  return {
    tipoOperacion: c.tipoOperacion ?? 'COMPRA',
    precio: aTexto(c.precio),
    moneda: c.moneda,
    tipoPropiedad: c.tipoPropiedad ?? '',
    zona: c.zona ?? '',
    ambientes: c.ambientes,
    m2: aTexto(c.m2),
    banos: aTexto(c.banos),
    cocheras: aTexto(c.cocheras),
    expensas: aTexto(c.expensas),
  }
}

/** Un número usable o null. `minimo` es 0 para cocheras y expensas, 1 para el resto. */
function aNumero(texto: string, minimo = 1): number | null {
  if (texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) && n >= minimo ? n : null
}

function aCriterios(b: Borrador): CriteriosOferta {
  return {
    tipoOperacion: b.tipoOperacion,
    precio: aNumero(b.precio),
    moneda: b.moneda,
    tipoPropiedad: b.tipoPropiedad || null,
    zona: b.zona.trim() || null,
    ambientes: b.ambientes,
    m2: aNumero(b.m2),
    banos: aNumero(b.banos),
    cocheras: aNumero(b.cocheras, 0),
    expensas: aNumero(b.expensas, 0),
  }
}

interface BarraCriteriosProps {
  /** Lo aplicado (sale de la URL). El borrador arranca de acá. */
  aplicados: CriteriosOferta
  /** Lista para el datalist de zona. */
  zonas: string[]
  onBuscar: (criterios: CriteriosOferta) => void
}

/**
 * La barra de búsqueda de Coincidencias, al estilo de un portal inmobiliario:
 * operación · tipo · zona · precio · ambientes · más criterios · Buscar.
 *
 * Lo que se carga es un borrador; recién "Buscar" (o Enter en cualquier campo)
 * lo escribe en la URL. La página remonta la barra cuando la URL cambia
 * (`key`), así el borrador siempre arranca de lo aplicado.
 *
 * En mobile se colapsa detrás de "Filtros (N)" y se despliega en vertical.
 */
export function BarraCriterios({ aplicados, zonas, onBuscar }: BarraCriteriosProps) {
  const id = useId()
  const [borrador, setBorrador] = useState<Borrador>(() => desdeCriterios(aplicados))
  // Mobile: abierta de entrada si todavía no se buscó nada.
  const [abiertaMobile, setAbiertaMobile] = useState(() => !hayCriterioDeOferta(aplicados))
  // "Más criterios" arranca abierto si alguno de adentro ya viene cargado: si
  // no, no se vería por qué los resultados son esos.
  const [masAbierto, setMasAbierto] = useState(
    () =>
      aplicados.m2 != null ||
      aplicados.banos != null ||
      aplicados.cocheras != null ||
      aplicados.expensas != null,
  )

  const criterios = aCriterios(borrador)
  const puedeBuscar = hayCriterioDeOferta(criterios)
  const cantidadMas = [criterios.m2, criterios.banos, criterios.cocheras, criterios.expensas].filter(
    (v) => v != null,
  ).length

  function cambiar<K extends keyof Borrador>(clave: K, valor: Borrador[K]) {
    setBorrador((b) => ({ ...b, [clave]: valor }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (puedeBuscar) onBuscar(criterios)
  }

  /** Los <select> no envían el form con Enter por su cuenta; los inputs sí. */
  function enterEnSelect(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && e.target instanceof HTMLSelectElement) {
      e.preventDefault()
      e.currentTarget.requestSubmit()
    }
  }

  return (
    <div className="rounded-[16px] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setAbiertaMobile((a) => !a)}
        aria-expanded={abiertaMobile}
        aria-controls={`${id}-form`}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left lg:hidden"
      >
        <span className="text-[0.95rem] font-bold text-ink">
          Filtros ({contarCriterios(aplicados)})
        </span>
        <span aria-hidden className="text-ink-3">
          {abiertaMobile ? '▲' : '▼'}
        </span>
      </button>

      <form
        id={`${id}-form`}
        onSubmit={enviar}
        onKeyDown={enterEnSelect}
        aria-label="Criterios de búsqueda"
        className={`${abiertaMobile ? 'block' : 'hidden'} border-t border-border p-4 lg:block lg:border-t-0 lg:p-3`}
      >
        {/*
          Mobile: una columna. lg y xl: dos filas prolijas de 4 columnas.
          2xl: todo en una fila, cada control con su ancho natural o una
          fracción del sobrante. Con el sidebar de 240px, recién desde 2xl
          entran los siete controles sin apretarse.
        */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 2xl:grid-cols-[auto_minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(13rem,1.5fr)_auto_auto_auto] 2xl:items-center">
          <div role="group" aria-label="Operación" className={SEGMENTADO}>
            {OPERACIONES.map((op) => (
              <button
                key={op.valor}
                type="button"
                aria-pressed={borrador.tipoOperacion === op.valor}
                onClick={() => cambiar('tipoOperacion', op.valor)}
                className={claseOpcion(borrador.tipoOperacion === op.valor)}
              >
                {op.label}
              </button>
            ))}
          </div>

          <select
            value={borrador.tipoPropiedad}
            onChange={(e) => cambiar('tipoPropiedad', e.target.value as TipoPropiedad | '')}
            aria-label="Tipo de propiedad"
            className={CONTROL}
          >
            <option value="">Cualquier tipo</option>
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>

          <div>
            <input
              type="text"
              list={`${id}-zonas`}
              autoComplete="off"
              value={borrador.zona}
              onChange={(e) => cambiar('zona', e.target.value)}
              aria-label="Zona"
              placeholder="Zona"
              className={CONTROL}
            />
            <datalist id={`${id}-zonas`}>
              {zonas.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div className="flex gap-2">
            <select
              value={borrador.moneda}
              onChange={(e) => cambiar('moneda', e.target.value === 'ARS' ? 'ARS' : 'USD')}
              aria-label="Moneda"
              className={`${CONTROL_SIN_ANCHO} w-[5.75rem] shrink-0`}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <InputMiles
              valor={borrador.precio}
              onCambiar={(v) => cambiar('precio', v)}
              etiqueta="Precio"
              placeholder="Precio"
            />
          </div>

          <div role="group" aria-label="Ambientes" className={SEGMENTADO}>
            {AMBIENTES.map((n) => {
              const activo = borrador.ambientes === n
              const tope = n === AMBIENTES_TOPE
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={activo}
                  aria-label={tope ? `${n} o más ambientes` : `${n} ${n === 1 ? 'ambiente' : 'ambientes'}`}
                  title={tope ? `${n} o más ambientes` : `${n} ${n === 1 ? 'ambiente' : 'ambientes'}`}
                  // Tocar el elegido lo desmarca: "ambientes" deja de contar.
                  onClick={() => cambiar('ambientes', activo ? null : n)}
                  className={`${claseOpcion(activo)} min-w-9`}
                >
                  {tope ? `${n}+` : n}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setMasAbierto((a) => !a)}
            aria-expanded={masAbierto}
            aria-controls={`${id}-mas`}
            className={`inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ${CONTROL} ${
              cantidadMas > 0 ? 'border-primary text-primary' : 'text-ink-2'
            } 2xl:w-auto`}
          >
            Más criterios
            {cantidadMas > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-contrast">
                {cantidadMas}
              </span>
            )}
            <span aria-hidden className="text-ink-3">
              {masAbierto ? '▴' : '▾'}
            </span>
          </button>

          <button
            type="submit"
            disabled={!puedeBuscar}
            title={puedeBuscar ? undefined : 'Cargá al menos un dato: tipo, zona, precio o ambientes'}
            // Mobile: al final de la columna (`order-last`). Desktop: en su lugar de la barra.
            className="order-last inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none lg:order-none"
          >
            Buscar
          </button>

          {masAbierto && (
            <div
              id={`${id}-mas`}
              className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-2 p-3 lg:col-span-full lg:grid-cols-4"
            >
              <Campo texto="Superficie mínima">
                <div className="relative">
                  <InputMiles
                    valor={borrador.m2}
                    onCambiar={(v) => cambiar('m2', v)}
                    etiqueta="Superficie en m²"
                    conSufijo
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.85rem] text-ink-3"
                  >
                    m²
                  </span>
                </div>
              </Campo>
              <Campo texto="Baños">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={borrador.banos}
                  onChange={(e) => cambiar('banos', e.target.value)}
                  aria-label="Baños"
                  className={CONTROL}
                />
              </Campo>
              <Campo texto="Cocheras">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={borrador.cocheras}
                  onChange={(e) => cambiar('cocheras', e.target.value)}
                  aria-label="Cocheras"
                  className={CONTROL}
                />
              </Campo>
              <Campo texto="Expensas máximas">
                <InputMiles
                  valor={borrador.expensas}
                  onCambiar={(v) => cambiar('expensas', v)}
                  etiqueta="Expensas máximas"
                />
              </Campo>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

/** Etiqueta chica arriba del control, sólo dentro de "Más criterios". */
function Campo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden className="text-[0.78rem] font-semibold text-ink-2">
        {texto}
      </span>
      {children}
    </div>
  )
}

/** Sólo dígitos, con un tope que deja afuera montos absurdos. */
const soloDigitos = (texto: string) => texto.replace(/\D/g, '').slice(0, 12)

/** "250000" → "250.000". */
const conMiles = (digitos: string) => (digitos ? Number(digitos).toLocaleString('es-AR') : '')

/**
 * Input numérico que muestra los miles (250.000) y guarda sólo los dígitos.
 *
 * Al reformatear, el cursor se volvería al final. Para que no salte cuando se
 * edita en el medio, se cuenta cuántos dígitos había a su izquierda y, ya
 * formateado, se lo vuelve a poner después de esa misma cantidad de dígitos.
 */
function InputMiles({
  valor,
  onCambiar,
  etiqueta,
  placeholder,
  conSufijo = false,
}: {
  valor: string
  onCambiar: (digitos: string) => void
  etiqueta: string
  placeholder?: string
  /** Deja lugar a la derecha para un sufijo como "m²". */
  conSufijo?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const digitosAntesDelCursor = useRef<number | null>(null)
  const mostrado = conMiles(valor)

  useLayoutEffect(() => {
    const input = ref.current
    const objetivo = digitosAntesDelCursor.current
    if (!input || objetivo === null || document.activeElement !== input) return
    digitosAntesDelCursor.current = null

    let posicion = 0
    let vistos = 0
    while (posicion < mostrado.length && vistos < objetivo) {
      if (/\d/.test(mostrado[posicion])) vistos += 1
      posicion += 1
    }
    input.setSelectionRange(posicion, posicion)
  }, [mostrado])

  function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const { value, selectionStart } = e.target
    digitosAntesDelCursor.current = soloDigitos(value.slice(0, selectionStart ?? value.length)).length
    onCambiar(soloDigitos(value))
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={mostrado}
      onChange={cambiar}
      aria-label={etiqueta}
      placeholder={placeholder}
      className={`${CONTROL} min-w-0 tabular-nums ${conSufijo ? 'pr-10' : ''}`}
    />
  )
}
