import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { ModalConfirmarEliminar } from '../components/comunes/ModalConfirmarEliminar'
import { Spinner } from '../components/Spinner'
import { IndicadorUso } from '../components/suscripcion/IndicadorUso'
import { useAuth } from '../contexts/AuthContext'
import {
  useCancelarSuscripcion,
  useCrearSuscripcion,
  useEstadoSuscripcion,
  usePagos,
  usePreciosPlanes,
} from '../hooks/useSuscripcion'
import { useUsoRecursos } from '../hooks/useUsoRecursos'
import { formatearFecha } from '../lib/formatoFecha'
import { mensajeDeListado } from '../lib/mensajesDeError'
import {
  DETALLE_PLAN,
  interpretarVuelta,
  type EstadoDeMiSuscripcion,
  type PagoDelHistorial,
  type Plan,
  type PrecioPlan,
  type TonoVuelta,
} from '../lib/api/suscripcion'

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Los dos modos de la pantalla.
 *
 * `cuenta` es el estado de la suscripción que ya se tiene; `elegir` es el
 * catálogo comercial. Antes convivían en una sola vista, y mezclaban dos
 * preguntas distintas —"cómo vengo" y "qué contrato"— que casi nunca se hacen
 * al mismo tiempo.
 */
type Vista = 'cuenta' | 'elegir'

interface DistintivoEstado {
  texto: string
  clases: string
}

/**
 * El cartelito de estado de la suscripción.
 *
 * `cancelacion_solicitada` gana sobre el estado: la fila sigue ACTIVA hasta la
 * fecha de corte, pero para quien la mira lo que importa es que ya dio de baja.
 */
function distintivoDeEstado(estado: EstadoDeMiSuscripcion): DistintivoEstado {
  if (estado.cancelacionSolicitada) {
    return { texto: 'Cancelada', clases: 'bg-surface-2 text-ink-2' }
  }

  switch (estado.estado) {
    case 'TRIAL':
      return { texto: 'Período de prueba', clases: 'bg-cool-soft text-info' }
    case 'ACTIVA':
      return { texto: 'Al día', clases: 'bg-brand-soft text-primary' }
    case 'GRACIA':
      return { texto: 'Pago pendiente', clases: 'bg-warm-soft text-badge-tibio-ink' }
    case 'VENCIDA':
      return { texto: 'Vencida', clases: 'bg-peligro-soft text-peligro-ink' }
    case 'CANCELADA':
      return { texto: 'Cancelada', clases: 'bg-surface-2 text-ink-2' }
  }
}

/** Qué le pasa a la cuenta, en una línea. */
function explicacionDeEstado(estado: EstadoDeMiSuscripcion): string {
  if (estado.cancelacionSolicitada) {
    return 'Cancelaste la suscripción. No se te va a cobrar de nuevo.'
  }

  switch (estado.estado) {
    case 'TRIAL':
      return 'Estás probando LeadEra gratis. Cuando se termine la prueba elegís si seguir.'
    case 'ACTIVA':
      return 'Tu suscripción está activa. No tenés que hacer nada.'
    case 'GRACIA':
      return 'No pudimos cobrar el último mes. Mercado Pago va a reintentar; revisá que tu medio de pago tenga fondos.'
    case 'VENCIDA':
      return 'Se te terminó el acceso. Elegí un plan para volver a usar LeadEra.'
    case 'CANCELADA':
      return 'Diste de baja la suscripción. Podés volver a contratar cuando quieras.'
  }
}

const TONOS: Record<TonoVuelta, string> = {
  exito: 'border-primary/30 bg-brand-soft text-ink',
  espera: 'border-tibio/40 bg-warm-soft text-ink',
  error: 'border-peligro-borde bg-peligro-soft text-peligro-ink',
}

export default function Suscripcion() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const precios = usePreciosPlanes()
  const estado = useEstadoSuscripcion()
  const crear = useCrearSuscripcion()

  const [error, setError] = useState<string | null>(null)

  // La vista que el usuario pidió a mano. `null` es "la que corresponda", que
  // se resuelve abajo con los datos ya cargados: guardar acá el default llevaría
  // a sincronizarlo con una query que todavía está en vuelo cuando esto se
  // inicializa.
  //
  // Se puede llegar pidiendo el catálogo desde afuera: es lo que hace el link
  // de los formularios cuando una cuota del plan frena un alta, donde mostrar
  // el estado de la cuenta sería llevar al usuario un paso más lejos de lo que
  // vino a resolver.
  const [vistaManual, setVistaManual] = useState<Vista | null>(() =>
    (location.state as { vista?: Vista } | null)?.vista === 'elegir' ? 'elegir' : null,
  )

  // Se lee una sola vez, al montar: después los parámetros se limpian de la URL
  // y no queremos que el cartel desaparezca por eso.
  const [vuelta] = useState(() => interpretarVuelta(searchParams))

  // Sacar los parámetros de Mercado Pago de la barra de direcciones: si el
  // usuario refresca o comparte el link, no tiene por qué arrastrar el
  // resultado de un pago viejo.
  useEffect(() => {
    if (!vuelta) return
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [vuelta, setSearchParams])

  const esDueno = profile?.rol === 'DUENO'

  function elegir(plan: Plan) {
    setError(null)
    crear.mutate(plan, {
      // El flujo termina fuera de la app: no se apaga el estado de carga a
      // propósito, así el botón queda ocupado mientras el navegador se va.
      onSuccess: (data) => {
        window.location.href = data.init_point
      },
      onError: (e) => setError(e.message),
    })
  }

  if (precios.isPending || estado.isPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner label="Cargando los planes" />
      </div>
    )
  }

  if (precios.isError) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <EstadoError
          mensaje={mensajeDeListado(precios.error)}
          titulo="No pudimos mostrar los planes"
          accion={<BotonError onClick={() => precios.refetch()}>Reintentar</BotonError>}
        />
      </div>
    )
  }

  // El estado es null cuando la RLS de `inmobiliarias` no deja leer la fila.
  // Con el estado desconocido se muestran los planes: es la salida útil, y quien
  // decide de verdad es `crear-suscripcion`, que sí ve la fila.
  const miEstado = estado.data ?? null

  const comparacionConChica = compararConAgenciaChica(precios.data)

  // Sin plan asignado no hay cuenta que mostrar: la única pantalla útil es el
  // catálogo. Con plan, se entra por la cuenta y el catálogo queda a un click.
  const planActual = miEstado?.plan ?? null
  const vista: Vista = vistaManual ?? (planActual ? 'cuenta' : 'elegir')

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6">
        <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Mi inmobiliaria
        </p>
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Suscripción</h1>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          {vista === 'elegir'
            ? 'Elegí el plan que le sirve a tu inmobiliaria. Se cobra por mes y lo cancelás cuando quieras.'
            : 'El estado de tu plan, cuánto lo estás usando y tus cobros.'}
        </p>
      </header>

      {vuelta && (
        <div
          role="status"
          className={`mb-6 rounded-[16px] border px-5 py-4 ${TONOS[vuelta.tono]}`}
        >
          <p className="m-0 text-[0.95rem] font-bold">{vuelta.titulo}</p>
          <p className="mt-1 text-[0.9rem]">{vuelta.mensaje}</p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-[16px] border border-peligro-borde bg-peligro-soft px-5 py-4 text-[0.9rem] text-peligro-ink"
        >
          {error}
        </p>
      )}

      {vista === 'cuenta' && miEstado ? (
        <VistaCuenta
          estado={miEstado}
          precios={precios.data}
          esDueno={esDueno}
          onCambiarPlan={() => setVistaManual('elegir')}
        />
      ) : (
        <>
          {/* Sólo se ofrece la vuelta si hay una cuenta a la que volver: quien
              todavía no tiene plan llegó acá porque es su única pantalla. */}
          {planActual && (
            <button
              type="button"
              onClick={() => setVistaManual('cuenta')}
              className="mb-5 inline-flex items-center gap-1 rounded-md text-[0.9rem] font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              ‹ Volver a mi cuenta
            </button>
          )}

          {!esDueno && (
            <p className="mb-5 rounded-[16px] border border-border bg-surface-2 px-5 py-4 text-[0.9rem] text-ink-3">
              Estos son los planes de LeadEra. Sólo el dueño de la inmobiliaria puede contratarlos
              o cambiarlos.
            </p>
          )}

          {/* Las tarjetas no marcan cuál es el plan vigente: eso lo cuenta la
              vista de cuenta, que es de donde se llega hasta acá, y repetirlo
              sería decir dos veces lo mismo a una pantalla de distancia.

              El `pt` deja aire arriba para el badge de la tarjeta destacada,
              que sobresale por encima de su borde. */}
          <ul className="grid list-none grid-cols-1 items-stretch gap-4 p-0 pt-3 md:grid-cols-3 md:pt-5">
            {precios.data.map((precio) => (
              <TarjetaPlan
                key={precio.plan}
                precio={precio}
                comparacion={precio.plan === 'AGENCIA_GRANDE' ? comparacionConChica : null}
                deshabilitado={!esDueno || crear.isPending}
                cargando={crear.isPending && crear.variables === precio.plan}
                onElegir={() => elegir(precio.plan)}
              />
            ))}
          </ul>

          <p className="mt-5 text-[0.8rem] text-ink-3">
            Los precios están fijados en dólares y se convierten a pesos con la cotización del
            dólar MEP, que se actualiza una vez por semana.
          </p>
        </>
      )}
    </div>
  )
}

function UsoDelPlan({ plan }: { plan: Plan }) {
  const uso = useUsoRecursos(plan)

  // Ni skeleton ni cartel de error: es información de apoyo, y que aparezca
  // cuando está lista molesta menos que un hueco anunciándose en una pantalla
  // que se entra a mirar por otra cosa.
  if (uso.isPending || uso.isError) return null

  return (
    <section className="mt-8">
      <h2 className="m-0 text-[1.05rem] font-bold text-ink">Uso de tu plan</h2>
      <p className="mt-1 mb-4 text-[0.85rem] text-ink-3">
        Cuánto llevás cargado de lo que incluye el plan {DETALLE_PLAN[plan].nombre}.
      </p>

      <div className="grid grid-cols-1 gap-6 rounded-[16px] border border-border bg-surface px-6 py-5 shadow-md sm:grid-cols-3">
        <IndicadorUso etiqueta="Leads" unidad="leads" uso={uso.data.leads} />
        <IndicadorUso etiqueta="Propiedades" unidad="propiedades" uso={uso.data.propiedades} />
        <IndicadorUso
          etiqueta="Operaciones activas"
          unidad="operaciones activas"
          uso={uso.data.operacionesActivas}
        />
      </div>
    </section>
  )
}

function HistorialDePagos() {
  const { profile } = useAuth()
  const pagos = usePagos(profile?.inmobiliaria_id)

  // Sin cobros no se dibuja la sección: el encabezado de una tabla vacía no
  // agrega nada que el resumen de arriba no diga mejor.
  if (pagos.isPending || pagos.isError || pagos.data.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="m-0 text-[1.05rem] font-bold text-ink">Historial de pagos</h2>
      <p className="mt-1 mb-4 text-[0.85rem] text-ink-3">
        Los cobros de tu suscripción, del más reciente al más antiguo.
      </p>

      <ul className="list-none divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-surface p-0 shadow-md">
        {pagos.data.map((pago) => (
          <FilaDePago key={pago.id} pago={pago} />
        ))}
      </ul>
    </section>
  )
}

function FilaDePago({ pago }: { pago: PagoDelHistorial }) {
  const aprobado = pago.resultado === 'aprobado'

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <span className="text-[0.9rem] text-ink-2 tabular-nums">
        {formatearFecha(pago.fecha)}
      </span>

      <span
        className={`ml-auto text-[0.9rem] font-semibold tabular-nums ${
          aprobado ? 'text-ink' : 'text-ink-4 line-through'
        }`}
      >
        {pago.monto === null ? '—' : `$${MONTOS.format(pago.monto)}`}
      </span>

      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.75rem] font-bold uppercase ${
          aprobado ? 'bg-brand-soft text-primary' : 'bg-peligro-soft text-peligro-ink'
        }`}
      >
        {aprobado ? 'Aprobado' : 'Rechazado'}
      </span>
    </li>
  )
}

interface VistaCuentaProps {
  estado: EstadoDeMiSuscripcion
  precios: PrecioPlan[]
  esDueno: boolean
  onCambiarPlan: () => void
}

/**
 * El estado de la suscripción propia: qué plan se tiene, cómo viene la cuenta,
 * cuánto se está usando y qué se cobró.
 *
 * Es la entrada por defecto en cuanto hay un plan asignado —incluido el trial,
 * que desde que el alta lo pregunta también tiene uno—. El catálogo de planes
 * queda detrás de "Cambiar de plan": es una decisión puntual, no algo que haya
 * que mirar cada vez que se entra a ver cómo viene la cuenta.
 */
function VistaCuenta({ estado, precios, esDueno, onCambiarPlan }: VistaCuentaProps) {
  const detalle = estado.plan ? DETALLE_PLAN[estado.plan] : null
  const cancelada = estado.cancelacionSolicitada

  const [modalAbierto, setModalAbierto] = useState(false)
  const cancelar = useCancelarSuscripcion()

  // Sólo se ofrece la baja sobre una suscripción que se está cobrando. En
  // GRACIA el cobro ya falló y el camino es arreglar el medio de pago, no
  // cancelar; el backend además la rechazaría por no estar ACTIVA.
  const puedeCancelar = !cancelada && estado.estado === 'ACTIVA'

  const distintivo = distintivoDeEstado(estado)
  const precio = precios.find((p) => p.plan === estado.plan) ?? null
  const accesoHasta = estado.fecha_proximo_cobro
    ? formatearFecha(estado.fecha_proximo_cobro)
    : null

  function confirmarBaja() {
    cancelar.mutate(undefined, { onSuccess: () => setModalAbierto(false) })
  }

  return (
    <>
      <div className="rounded-[16px] border border-border bg-surface px-6 py-6 shadow-md">
        <p
          className={`m-0 inline-flex items-center rounded-full px-3 py-1 text-[0.75rem] font-bold uppercase ${distintivo.clases}`}
        >
          {distintivo.texto}
        </p>

        {/* El plan y su precio en la misma línea: son la respuesta a "qué tengo
            y cuánto cuesta", que es lo que se viene a mirar acá. */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="m-0 text-[1.4rem] leading-tight font-bold text-ink">
            {detalle ? `Plan ${detalle.nombre}` : 'Tu plan'}
          </h2>

          {precio?.precio_ars != null && (
            <p className="m-0 flex items-baseline gap-1.5">
              <span className="text-[1.25rem] leading-none font-bold tabular-nums text-ink">
                ${MONTOS.format(precio.precio_ars)}
              </span>
              <span className="text-[0.85rem] text-ink-3">por mes</span>
            </p>
          )}
        </div>

        <p className="mt-1.5 text-[0.9rem] text-ink-3">{explicacionDeEstado(estado)}</p>

        <FechaRelevante estado={estado} accesoHasta={accesoHasta} />
      </div>

      {/* Los dos reusados tal cual: el trial ya tiene topes que rigen, y los
          cobros viejos siguen explicando por qué la cuenta está donde está. */}
      {estado.plan && <UsoDelPlan plan={estado.plan} />}
      {estado.estado !== 'TRIAL' && <HistorialDePagos />}

      {/* Las dos salidas de la pantalla, juntas y al pie: cambiar de plan es
          poco frecuente, y dar de baja todavía menos. Ninguna compite con la
          información de arriba, que es a lo que se entra. */}
      {esDueno && (
        <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={onCambiarPlan}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink-3 transition-colors hover:bg-background hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Cambiar de plan
          </button>

          {puedeCancelar && (
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink-3 transition-colors hover:border-peligro-borde hover:bg-peligro-soft hover:text-peligro-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none"
            >
              Cancelar suscripción
            </button>
          )}
        </div>
      )}

      {puedeCancelar && (
        <ModalConfirmarEliminar
          abierto={modalAbierto}
          titulo="¿Cancelar la suscripción?"
          descripcion={
            accesoHasta
              ? `Vas a mantener acceso hasta el ${accesoHasta}. Después no se te va a cobrar más.`
              : 'Vas a mantener acceso hasta el final del período que ya pagaste. Después no se te va a cobrar más.'
          }
          nombre={detalle ? `Plan ${detalle.nombre}` : undefined}
          eliminando={cancelar.isPending}
          error={cancelar.isError ? cancelar.error.message : null}
          onCancelar={() => {
            if (cancelar.isPending) return
            cancelar.reset()
            setModalAbierto(false)
          }}
          onConfirmar={confirmarBaja}
          textoConfirmar="Sí, cancelar"
          textoConfirmando="Cancelando…"
          textoCancelar="No, seguir"
        />
      )}
    </>
  )
}

/**
 * La fecha que importa según cómo esté la cuenta.
 *
 * En el trial es cuándo se termina; con la baja pedida, hasta cuándo hay
 * acceso; cobrando, cuándo es el próximo cobro. Vencida o cancelada no tienen
 * una fecha por delante que decir.
 */
function FechaRelevante({
  estado,
  accesoHasta,
}: {
  estado: EstadoDeMiSuscripcion
  accesoHasta: string | null
}) {
  if (estado.cancelacionSolicitada) {
    if (!accesoHasta) return null
    return (
      <p className="mt-4 text-[0.9rem] text-ink-2">
        Tenés acceso hasta el <strong className="font-semibold text-ink">{accesoHasta}</strong>.
      </p>
    )
  }

  if (estado.estado === 'TRIAL') {
    if (!estado.fecha_fin_trial) return null
    return (
      <p className="mt-4 text-[0.9rem] text-ink-2">
        Tu prueba termina el{' '}
        <strong className="font-semibold text-ink">
          {formatearFecha(estado.fecha_fin_trial)}
        </strong>
        .
      </p>
    )
  }

  if (!accesoHasta || (estado.estado !== 'ACTIVA' && estado.estado !== 'GRACIA')) return null

  return (
    <p className="mt-4 text-[0.9rem] text-ink-2">
      Próximo cobro: <strong className="font-semibold text-ink">{accesoHasta}</strong>
    </p>
  )
}

/**
 * Cuánto más por mes cuesta Agencia Grande que Agencia Chica.
 *
 * Se calcula con los precios que ya se están mostrando, así que la frase no
 * puede quedar desactualizada cuando el dólar mueva los números. Devuelve null
 * si falta algún precio o si la diferencia no da un salto hacia arriba: en ese
 * caso la comparación no diría nada útil y es mejor no mostrarla.
 */
function compararConAgenciaChica(precios: PrecioPlan[]): string | null {
  const chica = precios.find((p) => p.plan === 'AGENCIA_CHICA')?.precio_ars
  const grande = precios.find((p) => p.plan === 'AGENCIA_GRANDE')?.precio_ars

  if (chica == null || grande == null || grande <= chica) return null

  return `Son $${MONTOS.format(grande - chica)} más por mes que Agencia Chica, no el doble.`
}

interface TarjetaPlanProps {
  precio: PrecioPlan
  /** La línea que compara este plan con el anterior, si aplica. */
  comparacion: string | null
  deshabilitado: boolean
  cargando: boolean
  onElegir: () => void
}

function TarjetaPlan({
  precio,
  comparacion,
  deshabilitado,
  cargando,
  onElegir,
}: TarjetaPlanProps) {
  const detalle = DETALLE_PLAN[precio.plan]
  // Sin precio en pesos no se puede contratar: `crear-suscripcion` rechazaría el
  // pedido igual, así que el botón no promete algo que no va a pasar.
  const sinPrecio = precio.precio_ars === null
  const destacado = detalle.destacado === true

  return (
    <li
      className={[
        'relative flex flex-col rounded-[16px] bg-surface px-5 py-5',
        // El destaque es estructural, no decorativo: la tarjeta arranca más
        // arriba que las otras dos y termina a la misma altura, así que además
        // de resaltar es más grande. En una sola columna eso no aplica.
        destacado
          ? 'border-2 border-primary shadow-modal md:-mt-4'
          : 'border border-border shadow-md',
      ].join(' ')}
    >
      {destacado && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[0.75rem] leading-none font-semibold whitespace-nowrap text-white">
          Más elegido
        </span>
      )}
      <h2 className="m-0 text-[1.05rem] font-bold text-ink">{detalle.nombre}</h2>
      <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">{detalle.bajada}</p>

      <p className="mt-4 mb-0 flex items-baseline gap-1.5">
        {sinPrecio ? (
          <span className="text-[1.1rem] font-bold text-ink-3">Precio no disponible</span>
        ) : (
          <>
            <span className="text-[1.75rem] leading-none font-bold tabular-nums text-ink">
              ${MONTOS.format(precio.precio_ars!)}
            </span>
            <span className="text-[0.85rem] text-ink-3">por mes</span>
          </>
        )}
      </p>
      <p className="mt-1 mb-0 text-[0.75rem] text-ink-4">
        Equivale a US$ {MONTOS.format(precio.precio_usd)} por mes
      </p>

      {comparacion && !sinPrecio && (
        <p className="mt-2 mb-0 text-[0.8rem] font-medium text-primary">{comparacion}</p>
      )}

      <ul className="mt-4 mb-0 flex grow list-none flex-col gap-2 p-0">
        {detalle.incluye.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[0.85rem] text-ink-2">
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            {item}
          </li>
        ))}
      </ul>

      {/* La lista de arriba crece y empuja el botón al piso de la tarjeta, así
          los tres quedan alineados aunque la destacada sea más alta. */}
      <button
        type="button"
        onClick={onElegir}
        disabled={deshabilitado || sinPrecio}
        className={[
          'mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
          'text-[0.9rem] font-semibold transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none',
          // Sólo el plan destacado lleva el botón relleno. Tres botones sólidos
          // iguales no le dicen al ojo por dónde empezar.
          destacado
            ? 'bg-primary text-white hover:bg-primary-dark'
            : 'border border-primary bg-surface text-primary hover:bg-brand-soft',
        ].join(' ')}
      >
        {cargando && (
          <span
            className={`size-4 animate-spin rounded-full border-2 motion-reduce:animate-none ${
              destacado ? 'border-white/40 border-t-white' : 'border-primary/30 border-t-primary'
            }`}
          />
        )}
        {cargando ? 'Abriendo Mercado Pago' : 'Elegir este plan'}
      </button>
    </li>
  )
}
