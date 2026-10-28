import { useEffect, useState } from 'react'
import { BotonCerrarModal } from '../comunes/BotonCerrarModal'
import { ComboboxLead } from '../comunes/ComboboxLead'
import { EnlaceAPlanes } from '../comunes/EnlaceAPlanes'
import { useCrearReserva, useOperacionesParecidas } from '../../hooks/useOperaciones'
import {
  etiquetaEstadoOperacion,
  etiquetaLeadDeOperacion,
  etiquetaTipoOperacion,
  tipoDeReserva,
  type ClaseOperacionReserva,
  type PuntaReserva,
} from '../../lib/api/operaciones'
import { esLimiteDePlan } from '../../lib/mensajesDeError'
import { hoyEnArgentina } from '../../lib/ritmoSemanal'
import {
  cantidadInvalida,
  excedeTope,
  MENSAJE_VALOR_ALTO,
  MINIMO_CANTIDAD,
  TOPE_PRECIO,
} from '../../lib/validaciones'
import { useUiStore } from '../../stores/ui'

const PUNTAS: { valor: PuntaReserva; label: string }[] = [
  { valor: 'vendedora', label: 'Vendedora' },
  { valor: 'compradora', label: 'Compradora' },
]

const AYUDA_PUNTA: Record<PuntaReserva, string> = {
  vendedora: 'La propiedad es tuya.',
  compradora: 'Tu cliente compra o alquila.',
}

const CLASES: { valor: ClaseOperacionReserva; label: string }[] = [
  { valor: 'venta', label: 'Venta' },
  { valor: 'alquiler', label: 'Alquiler' },
]

const MONEDAS = ['USD', 'ARS']

const MAX_TITULO = 120

/** Desde cuántos caracteres se busca un duplicado: con menos, todo se parece a todo. */
const MINIMO_PARA_PARECIDAS = 3

const DEBOUNCE_MS = 400

const etiquetaCampo = 'mb-1.5 block text-xs font-semibold text-ink-3 uppercase'
const campoSinAncho =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)]'

/**
 * El ancho va aparte para el select de moneda: con `w-full` en la base, un `w-24`
 * agregado después pierde por el orden de la hoja de estilos y el select ocupa todo
 * el renglón (ver `CLASES_CONTROL_SIN_ANCHO`).
 */
const campo = `w-full ${campoSinAncho}`

interface SegmentadoProps<T extends string> {
  etiqueta: string
  opciones: { valor: T; label: string }[]
  valor: T
  onCambiar: (valor: T) => void
}

/** Mismo control segmentado que `ModalNuevaVisita`, a ancho completo para el dedo. */
function Segmentado<T extends string>({ etiqueta, opciones, valor, onCambiar }: SegmentadoProps<T>) {
  return (
    <div role="group" aria-label={etiqueta} className="flex rounded-full border border-border bg-surface p-0.5">
      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(o.valor)}
            className={[
              'min-h-9 flex-1 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap',
              'transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activo ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-background hover:text-ink',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface ModalCargarReservaProps {
  onCerrar: () => void
}

/**
 * Registra una reserva en un solo paso: una operación creada ya en RESERVADA, sin
 * pasar por lead, propiedad ni búsqueda. El título es libre porque la propiedad
 * puede ser de otra inmobiliaria.
 */
export function ModalCargarReserva({ onCerrar }: ModalCargarReservaProps) {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  const [punta, setPunta] = useState<PuntaReserva>('vendedora')
  const [clase, setClase] = useState<ClaseOperacionReserva>('venta')
  const [titulo, setTitulo] = useState('')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const hoy = hoyEnArgentina()
  const [fecha, setFecha] = useState(hoy)
  const [leadId, setLeadId] = useState<string | null>(null)
  // Los errores de campo vacío se muestran recién al salir del campo o al enviar.
  const [tituloTocado, setTituloTocado] = useState(false)
  const [montoTocado, setMontoTocado] = useState(false)

  const crear = useCrearReserva()

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  // Se busca con el título que dejó de cambiar, no con cada tecla.
  const [tituloBuscado, setTituloBuscado] = useState('')
  useEffect(() => {
    const limpio = titulo.trim()
    const id = setTimeout(
      () => setTituloBuscado(limpio.length >= MINIMO_PARA_PARECIDAS ? limpio : ''),
      DEBOUNCE_MS,
    )
    return () => clearTimeout(id)
  }, [titulo])
  const parecidas = useOperacionesParecidas(tituloBuscado)
  const hayParecidas = tituloBuscado !== '' && (parecidas.data?.length ?? 0) > 0

  const tipo = tipoDeReserva(punta, clase)
  const montoVacio = !monto.trim()
  const montoInvalido = cantidadInvalida(monto)
  const montoAlto = excedeTope(monto, TOPE_PRECIO)
  const errorMonto = montoInvalido
    ? 'El monto tiene que ser 1 o más.'
    : montoAlto
      ? MENSAJE_VALOR_ALTO
      : montoTocado && montoVacio
        ? 'Ingresá el monto de la reserva.'
        : null
  const errorTitulo = tituloTocado && !titulo.trim() ? 'Ingresá el título de la reserva.' : null
  const etiquetaMonto = clase === 'venta' ? 'Precio de venta' : 'Alquiler mensual'
  const fechaFutura = !!fecha && fecha > hoy
  const faltaAlgo =
    !titulo.trim() || !fecha || fechaFutura || montoVacio || montoInvalido || montoAlto

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (faltaAlgo) {
      // El botón queda habilitado a propósito: si estuviera apagado, nadie se
      // enteraría de qué campo falta.
      setTituloTocado(true)
      setMontoTocado(true)
      return
    }
    // El botón ya se deshabilita mientras guarda, pero un Enter repetido llega
    // por el submit del form sin pasar por él y crearía la reserva dos veces.
    if (crear.isPending) return

    crear.mutate(
      {
        punta,
        operacion: clase,
        titulo,
        fecha,
        monto: Number(monto),
        moneda,
        lead_id: leadId,
      },
      {
        onSuccess: () => {
          mostrarAviso('Reserva cargada.')
          onCerrar()
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <form
        onSubmit={enviar}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cargar-reserva"
        className="my-auto w-full max-w-[460px] rounded-2xl bg-surface p-5 shadow-modal sm:p-6"
      >
        <BotonCerrarModal onCerrar={onCerrar} />
        <h2 id="titulo-cargar-reserva" className="m-0 pr-8 text-[1.05rem] font-bold text-ink">
          Cargar reserva
        </h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">
          Queda como una operación reservada, sin crear antes el lead ni la propiedad.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <span className={etiquetaCampo}>Tu punta</span>
            <Segmentado etiqueta="Tu punta" opciones={PUNTAS} valor={punta} onCambiar={setPunta} />
            <p className="mt-1.5 text-[0.75rem] text-ink-4">{AYUDA_PUNTA[punta]}</p>
          </div>

          <div>
            <span className={etiquetaCampo}>Operación</span>
            <Segmentado etiqueta="Operación" opciones={CLASES} valor={clase} onCambiar={setClase} />
          </div>

          <div>
            <label htmlFor="reserva-titulo" className={etiquetaCampo}>
              Título o dirección
            </label>
            <input
              id="reserva-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => setTituloTocado(true)}
              maxLength={MAX_TITULO}
              autoFocus
              placeholder="Ej: Alvear 1890, 3 amb"
              aria-invalid={errorTitulo !== null || undefined}
              aria-describedby={errorTitulo ? 'reserva-titulo-error' : undefined}
              className={campo}
            />
            {errorTitulo && (
              <p id="reserva-titulo-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                {errorTitulo}
              </p>
            )}
            {hayParecidas && (
              <p
                role="status"
                className="mt-2 rounded-lg border border-border bg-badge-tibio-bg px-3 py-2.5 text-[0.78rem] text-badge-tibio-ink"
              >
                Ya hay una operación abierta con ese título:{' '}
                {parecidas.data!
                  .map(
                    (o) =>
                      `${o.titulo?.trim() || etiquetaTipoOperacion(o.tipo)} (${etiquetaEstadoOperacion(o.tipo, o.estado)})`,
                  )
                  .join(', ')}
                . Podés cargar la reserva igual.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reserva-monto" className={etiquetaCampo}>
              {etiquetaMonto}
            </label>
            <div className="flex gap-2">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                aria-label="Moneda"
                className={`${campoSinAncho} w-24 shrink-0`}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                id="reserva-monto"
                type="number"
                inputMode="decimal"
                min={MINIMO_CANTIDAD}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="120000"
                onBlur={() => setMontoTocado(true)}
                aria-invalid={errorMonto !== null || undefined}
                aria-describedby={errorMonto ? 'reserva-monto-error' : undefined}
                className={`${campoSinAncho} min-w-0 flex-1`}
              />
            </div>
            {errorMonto && (
              <p id="reserva-monto-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                {errorMonto}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reserva-fecha" className={etiquetaCampo}>
              Fecha de la reserva
            </label>
            <input
              id="reserva-fecha"
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
              aria-invalid={fechaFutura || undefined}
              aria-describedby={fechaFutura ? 'reserva-fecha-error' : undefined}
              className={campo}
            />
            {fechaFutura && (
              <p id="reserva-fecha-error" className="mt-1 text-[0.78rem] text-peligro-ink">
                La reserva no puede tener una fecha futura.
              </p>
            )}
          </div>

          <div>
            <span className={etiquetaCampo}>
              {etiquetaLeadDeOperacion(tipo)} <span className="normal-case">(opcional)</span>
            </span>
            <ComboboxLead value={leadId} onChange={setLeadId} />
          </div>
        </div>

        {crear.isError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2.5 text-[0.82rem] text-peligro-ink"
          >
            <p className="m-0">{crear.error.message}</p>
            {esLimiteDePlan(crear.error) && <EnlaceAPlanes />}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-10 rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={crear.isPending}
            className="min-h-10 rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {crear.isPending ? 'Cargando…' : 'Cargar reserva'}
          </button>
        </div>
      </form>
    </div>
  )
}
