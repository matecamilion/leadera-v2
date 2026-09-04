import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { ModalConfirmarEliminar } from '../components/comunes/ModalConfirmarEliminar'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../contexts/AuthContext'
import {
  useCancelarSuscripcion,
  useCrearSuscripcion,
  useEstadoSuscripcion,
  usePreciosPlanes,
} from '../hooks/useSuscripcion'
import { formatearFecha } from '../lib/formatoFecha'
import { mensajeDeListado } from '../lib/mensajesDeError'
import {
  DETALLE_PLAN,
  interpretarVuelta,
  type EstadoDeMiSuscripcion,
  type Plan,
  type PrecioPlan,
  type TonoVuelta,
} from '../lib/api/suscripcion'

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Estados en los que todavía hay que elegir un plan.
 *
 * CANCELADA entra igual que TRIAL y VENCIDA: quien dio de baja tiene que poder
 * volver a contratar sin pasar por soporte.
 */
const ESTADOS_SIN_SUSCRIPCION = ['TRIAL', 'VENCIDA', 'CANCELADA']

const TONOS: Record<TonoVuelta, string> = {
  exito: 'border-primary/30 bg-brand-soft text-ink',
  espera: 'border-tibio/40 bg-warm-soft text-ink',
  error: 'border-peligro-borde bg-peligro-soft text-peligro-ink',
}

export default function Suscripcion() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const precios = usePreciosPlanes()
  const estado = useEstadoSuscripcion()
  const crear = useCrearSuscripcion()

  const [error, setError] = useState<string | null>(null)

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
  const alDia =
    miEstado !== null &&
    miEstado.tieneSuscripcionEnMp &&
    !ESTADOS_SIN_SUSCRIPCION.includes(miEstado.estado)

  const comparacionConChica = compararConAgenciaChica(precios.data)

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6">
        <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Mi inmobiliaria
        </p>
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Suscripción</h1>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          {!alDia
            ? 'Elegí el plan que le sirve a tu inmobiliaria. Se cobra por mes y lo cancelás cuando quieras.'
            : miEstado?.cancelacionSolicitada
              ? 'Tu plan y hasta cuándo seguís teniendo acceso.'
              : 'El estado de tu plan y cuándo es el próximo cobro.'}
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

      {alDia && miEstado ? (
        <ResumenAlDia estado={miEstado} />
      ) : (
        <>
          {!esDueno && (
            <p className="mb-5 rounded-[16px] border border-border bg-surface-2 px-5 py-4 text-[0.9rem] text-ink-3">
              Estos son los planes de LeadEra. Sólo el dueño de la inmobiliaria puede contratarlos
              o cambiarlos.
            </p>
          )}

          {/* El `pt` deja aire arriba para el badge de la tarjeta destacada,
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

function ResumenAlDia({ estado }: { estado: EstadoDeMiSuscripcion }) {
  const detalle = estado.plan ? DETALLE_PLAN[estado.plan] : null
  const enGracia = estado.estado === 'GRACIA'
  const cancelada = estado.cancelacionSolicitada

  const [modalAbierto, setModalAbierto] = useState(false)
  const cancelar = useCancelarSuscripcion()

  // Sólo se ofrece la baja sobre una suscripción que se está cobrando. En
  // GRACIA el cobro ya falló y el camino es arreglar el medio de pago, no
  // cancelar; el backend además la rechazaría por no estar ACTIVA.
  const puedeCancelar = !cancelada && estado.estado === 'ACTIVA'

  const accesoHasta = estado.fecha_proximo_cobro
    ? formatearFecha(estado.fecha_proximo_cobro)
    : null

  function confirmarBaja() {
    cancelar.mutate(undefined, { onSuccess: () => setModalAbierto(false) })
  }

  return (
    <div className="rounded-[16px] border border-border bg-surface px-6 py-6 shadow-md">
      <p
        className={`m-0 inline-flex items-center rounded-full px-3 py-1 text-[0.75rem] font-bold uppercase ${
          cancelada
            ? 'bg-surface-2 text-ink-2'
            : enGracia
              ? 'bg-warm-soft text-badge-tibio-ink'
              : 'bg-brand-soft text-primary'
        }`}
      >
        {cancelada ? 'Cancelada' : enGracia ? 'Pago pendiente' : 'Al día'}
      </p>

      <h2 className="mt-3 mb-0 text-[1.25rem] font-bold text-ink">
        {detalle ? `Plan ${detalle.nombre}` : 'Tu plan'}
      </h2>

      <p className="mt-1 text-[0.9rem] text-ink-3">
        {cancelada
          ? 'Cancelaste la suscripción. No se te va a cobrar de nuevo.'
          : enGracia
            ? 'No pudimos cobrar el último mes. Mercado Pago va a reintentar; revisá que tu medio de pago tenga fondos.'
            : 'Tu suscripción está activa. No tenés que hacer nada.'}
      </p>

      {/* Cancelada: lo que importa no es cuándo se cobra —no se cobra más—
          sino hasta cuándo se puede seguir usando. */}
      {cancelada ? (
        accesoHasta && (
          <p className="mt-4 text-[0.9rem] text-ink-2">
            Tenés acceso hasta el{' '}
            <strong className="font-semibold text-ink">{accesoHasta}</strong>.
          </p>
        )
      ) : (
        estado.fecha_proximo_cobro && (
          <p className="mt-4 text-[0.9rem] text-ink-2">
            Próximo cobro:{' '}
            <strong className="font-semibold text-ink">{accesoHasta}</strong>
          </p>
        )
      )}

      {puedeCancelar && (
        <>
          {/* Acción destructiva y poco frecuente: va discreta, abajo y separada
              del resto, para que no compita con la información del plan. */}
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-[0.85rem] font-semibold text-ink-3 transition-colors hover:border-peligro-borde hover:bg-peligro-soft hover:text-peligro-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none"
            >
              Cancelar suscripción
            </button>
          </div>

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
        </>
      )}
    </div>
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
