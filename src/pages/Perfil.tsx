import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import {
  useConectarGoogle,
  useCambiarImportacionGoogle,
  useConexionGoogle,
  useDesconectarGoogle,
} from '../hooks/useGoogleCalendar'
import { BarraTabs } from '../components/comunes/BarraTabs'
import { ModalActivarImportacion } from '../components/perfil/ModalActivarImportacion'
import { ModalActivarReporteSemanal } from '../components/reporte/ModalActivarReporteSemanal'
import { ModalDesconectarGoogle } from '../components/perfil/ModalDesconectarGoogle'
import {
  useCambiarReporteSemanal,
  useReporteSemanal,
} from '../hooks/useReporteSemanal'
import {
  actualizarDatosCuenta,
  cambiarPassword,
  LARGO_MINIMO_PASSWORD,
} from '../lib/api/perfil'
import { DETALLE_PLAN, type EstadoSuscripcion } from '../lib/api/suscripcion'

function iniciales(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase() || 'A'
}

const ETIQUETA_ROL: Record<string, string> = {
  DUENO: 'Dueño',
  AGENTE: 'Agente',
  ASISTENTE: 'Asistente',
}

type TabPerfil = 'cuenta' | 'plan' | 'integraciones' | 'notificaciones'

export default function Perfil() {
  const { user, profile, refrescarPerfil } = useAuth()

  // Estado interno y no en la URL, igual que la ficha de lead: /perfil siempre
  // abre en "Mi cuenta", que es a lo que se entra a mirar la mayoría de las
  // veces.
  const [activa, setActiva] = useState<TabPerfil>('cuenta')

  const nombre = profile?.nombre ?? ''
  const apellido = profile?.apellido ?? ''
  const rol = profile ? (ETIQUETA_ROL[profile.rol] ?? profile.rol) : ''

  // El plan es de la inmobiliaria entera y sólo el dueño lo contrata o lo
  // cambia, así que a un agente o a un asistente esta sección no le sirve de
  // nada. Mientras `profile` carga es null y el chequeo da false: la sección
  // aparece recién cuando sabemos el rol, nunca antes.
  const esDueno = profile?.rol === 'DUENO'

  return (
    <div className="mx-auto max-w-[720px]">
      <header className="mb-6 flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-[1.15rem] font-bold text-primary"
        >
          {iniciales(nombre || 'A', apellido)}
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Mi perfil</h1>
          <p className="mt-1 truncate text-[0.9rem] text-ink-3">
            {profile ? `${nombre} ${apellido}`.trim() : user?.email}
            {rol ? ` · ${rol}` : ''}
          </p>
        </div>
      </header>

      {/* La pestaña de Plan sólo existe para el dueño: el plan es de la
          inmobiliaria entera y un agente no lo contrata ni lo cambia. Se arma
          la lista acá, así la barra no tiene que saber de roles. */}
      <BarraTabs
        etiqueta="Secciones del perfil"
        tabs={[
          { id: 'cuenta' as const, label: 'Mi cuenta' },
          ...(esDueno ? [{ id: 'plan' as const, label: 'Plan y facturación' }] : []),
          { id: 'integraciones' as const, label: 'Integraciones' },
          { id: 'notificaciones' as const, label: 'Notificaciones' },
        ]}
        activa={activa}
        onCambiar={setActiva}
      />

      {/* Cada pestaña monta sólo lo suyo: lo que no se ve no pide datos ni
          queda con estado a medio llenar. El `space-y-4` es el mismo aire que
          tenían las tarjetas cuando iban apiladas. */}
      <div className="space-y-4">
        {activa === 'cuenta' && (
          <>
            {/* El borrador del form arranca del profile; el key lo remonta
                cuando el profile cambia de verdad, así un refetch no pisa lo
                tipeado. */}
            <DatosDeCuenta
              key={`${nombre}|${apellido}`}
              nombreActual={nombre}
              apellidoActual={apellido}
              email={user?.email ?? ''}
              rol={rol}
              deshabilitado={profile == null}
              alGuardar={refrescarPerfil}
            />

            <CambiarPassword />
          </>
        )}

        {activa === 'plan' && esDueno && <PlanYFacturacion />}

        {activa === 'integraciones' && <GoogleCalendar />}

        {activa === 'notificaciones' && <NotificacionesPorEmail />}
      </div>
    </div>
  )
}

/**
 * El switch de prender y apagar, con la misma forma en todas partes.
 *
 * Estaba duplicado entre la importación de Calendar y el reporte semanal, y
 * cada notificación nueva iba a sumar otra copia de las mismas veinte clases.
 */
function Interruptor({
  encendido,
  etiqueta,
  deshabilitado = false,
  onAlternar,
}: {
  encendido: boolean
  /** Lo que lee un lector de pantalla: el switch no tiene texto propio. */
  etiqueta: string
  deshabilitado?: boolean
  onAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      onClick={onAlternar}
      disabled={deshabilitado}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
        encendido ? 'bg-primary' : 'bg-ink-4'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${
          encendido ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/**
 * Una fila de la tarjeta de notificaciones: qué es, qué implica y su switch.
 *
 * Sumar otra notificación es agregar una fila más adentro de
 * `NotificacionesPorEmail`; no hay que tocar el layout. Las filas se separan
 * con una línea, y el `first`/`last` saca el aire de los extremos, que ya lo
 * pone la tarjeta.
 */
function FilaNotificacion({
  titulo,
  detalle,
  encendido,
  deshabilitado,
  onAlternar,
  error,
}: {
  titulo: string
  detalle: string
  encendido: boolean
  deshabilitado: boolean
  onAlternar: () => void
  error?: string | null
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 max-w-[32rem]">
          <p className="m-0 text-[0.9rem] font-semibold text-ink">{titulo}</p>
          <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-3">{detalle}</p>
        </div>

        <Interruptor
          encendido={encendido}
          etiqueta={titulo}
          deshabilitado={deshabilitado}
          onAlternar={onAlternar}
        />
      </div>

      {error && (
        <p className="mt-3">
          <Aviso estado={{ tipo: 'error', mensaje: error }} />
        </p>
      )}
    </div>
  )
}

/**
 * Las notificaciones que llegan por mail.
 *
 * Hoy hay una sola —el reporte semanal—, pero la tarjeta ya es una lista: la
 * próxima entra como otra `FilaNotificacion` y nada más. Si algún día hay
 * notificaciones que no son por mail, van en otra tarjeta de este mismo grupo.
 */
function NotificacionesPorEmail() {
  return (
    <Tarjeta
      titulo="Por email"
      descripcion="Elegí qué querés recibir en tu casilla de correo."
    >
      <div className="divide-y divide-border">
        <FilaReporteSemanal />
      </div>
    </Tarjeta>
  )
}

/**
 * El opt-in del reporte semanal por email.
 *
 * Mismo patrón que el toggle de importación de Google Calendar: prender pasa
 * por un modal, apagar es directo, y el switch pinta lo que dice la base en vez
 * de un estado local que se pueda desincronizar.
 *
 * La sugerencia que invita a activarlo vive en Mi día (`AvisoReporteSemanal`);
 * acá está el control permanente, que es donde alguien lo va a buscar para
 * apagarlo.
 */
function FilaReporteSemanal() {
  const { data: activo, isPending } = useReporteSemanal()
  const cambiar = useCambiarReporteSemanal()
  const [confirmando, setConfirmando] = useState(false)

  const encendido = activo === true

  function alternar() {
    if (!encendido) {
      cambiar.reset()
      setConfirmando(true)
      return
    }
    cambiar.mutate(false)
  }

  return (
    <>
      <FilaNotificacion
        titulo="Recibir el reporte semanal"
        detalle="Te llega a tu email todos los lunes a las 9 de la mañana. Podés desactivarlo cuando quieras."
        encendido={encendido}
        deshabilitado={cambiar.isPending || isPending}
        onAlternar={alternar}
        // El error de apagar se muestra en la fila; el de prender vive dentro
        // del modal, que es donde el agente está mirando.
        error={cambiar.isError && !confirmando ? cambiar.error.message : null}
      />

      {confirmando && (
        <ModalActivarReporteSemanal
          activando={cambiar.isPending}
          error={cambiar.isError ? cambiar.error.message : null}
          onConfirmar={() =>
            cambiar.mutate(true, { onSuccess: () => setConfirmando(false) })
          }
          onCancelar={() => {
            cambiar.reset()
            setConfirmando(false)
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Plan y facturación — sólo para el dueño
// ---------------------------------------------------------------------------

/** Cómo se nombra cada estado de suscripción en pantalla. */
const ETIQUETA_ESTADO: Record<EstadoSuscripcion, string> = {
  TRIAL: 'Período de prueba',
  ACTIVA: 'Al día',
  GRACIA: 'Pago pendiente',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

/** Paleta del badge según qué tan urgente es el estado. */
const TONO_ESTADO: Record<EstadoSuscripcion, string> = {
  TRIAL: 'bg-surface-2 text-ink-2',
  ACTIVA: 'bg-brand-soft text-primary',
  GRACIA: 'bg-warm-soft text-badge-tibio-ink',
  VENCIDA: 'bg-peligro-soft text-peligro-ink',
  CANCELADA: 'bg-peligro-soft text-peligro-ink',
}

/**
 * El acceso del dueño a /suscripcion desde su perfil.
 *
 * El plan y el estado se muestran sólo si se pueden leer: hoy `inmobiliarias`
 * no tiene policy de SELECT para usuarios autenticados, así que la fila vuelve
 * vacía y queda nada más el link, que es lo que esta iteración necesita.
 * Cuando se agregue la policy, el resumen aparece solo.
 */
function PlanYFacturacion() {
  const estado = useEstadoSuscripcion()
  const datos = estado.data ?? null
  const detalle = datos?.plan ? DETALLE_PLAN[datos.plan] : null

  return (
    <Tarjeta
      titulo="Plan y facturación"
      descripcion="El plan de tu inmobiliaria y cómo se cobra."
    >
      {datos && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[0.95rem] font-semibold text-ink">
            {detalle ? `Plan ${detalle.nombre}` : 'Sin plan contratado'}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold ${TONO_ESTADO[datos.estado]}`}
          >
            {ETIQUETA_ESTADO[datos.estado]}
          </span>
        </div>
      )}

      <Link
        to="/suscripcion"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        Ver planes y facturación
      </Link>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

/**
 * Qué le decimos al agente cuando vuelve del consentimiento.
 *
 * El callback redirige acá con `?google=conectado` o con
 * `?google=error&motivo=...`. Los motivos son los que define
 * `google-oauth-callback`; cualquier otro cae en el mensaje genérico, así que
 * agregar uno nuevo allá no rompe esta pantalla.
 */
const MENSAJE_VUELTA: Record<string, string> = {
  acceso_denegado: 'No autorizaste el acceso, así que no conectamos nada.',
  state_invalido: 'El pedido venció o no era válido. Probá conectar de nuevo.',
  sin_codigo: 'Google no devolvió la autorización. Probá de nuevo.',
  token_error: 'No pudimos completar la conexión con Google. Probá de nuevo.',
  sin_refresh_token:
    'Google no nos dio un permiso duradero. Quitá el acceso de LeadEra en ' +
    'myaccount.google.com/permissions y volvé a conectar.',
  guardado_error: 'Conectamos con Google pero no pudimos guardar el permiso. Probá de nuevo.',
}

/**
 * Conectar el calendario del agente.
 *
 * Está fuera del `esDueno`: la agenda es de cada uno, no de la inmobiliaria, así
 * que la ve cualquier rol.
 */
function GoogleCalendar() {
  const conexion = useConexionGoogle()
  const conectar = useConectarGoogle()
  const desconectar = useDesconectarGoogle()
  const cambiarImportacion = useCambiarImportacionGoogle()
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  /** El modal de prender la importación. Apagar no pasa por acá. */
  const [confirmandoImportacion, setConfirmandoImportacion] = useState(false)
  /** El aviso de "ya arranca", hasta que el agente lo cierre. */
  const [avisoImportacion, setAvisoImportacion] = useState(false)
  const [params, setParams] = useSearchParams()

  const vuelta = params.get('google')
  const motivo = params.get('motivo')

  // El aviso se limpia de la URL al cerrarlo: si quedara, un F5 lo volvería a
  // mostrar como si el agente acabara de conectar.
  const cerrarAviso = () => {
    const limpio = new URLSearchParams(params)
    limpio.delete('google')
    limpio.delete('motivo')
    setParams(limpio, { replace: true })
  }

  // `null` es "nunca conectó"; `conectado: false` es "conectó y le revocaron el
  // permiso". Se distinguen porque el segundo pide reconectar, no conectar.
  const estado = conexion.data
  const conectado = estado?.conectado === true
  const necesitaReconectar = estado != null && !estado.conectado
  // El toggle pinta lo que dice la base, no un estado local: así no puede
  // quedar prendido en pantalla y apagado en la fila.
  const importacionActiva = estado?.importacionActiva === true

  /**
   * Prender pasa por el modal; apagar es directo. El click no cambia nada por
   * su cuenta: lo que manda es lo que devuelve la mutación.
   */
  function alternarImportacion() {
    if (!importacionActiva) {
      cambiarImportacion.reset()
      setConfirmandoImportacion(true)
      return
    }
    setAvisoImportacion(false)
    cambiarImportacion.mutate(false)
  }

  return (
    <Tarjeta
      titulo="Google Calendar"
      descripcion="Tus tareas y visitas aparecen como eventos en tu calendario de Google."
    >
      {vuelta === 'conectado' && (
        <div className="mb-4">
          <Aviso estado={{ tipo: 'ok', mensaje: 'Listo, tu Google Calendar quedó conectado.' }} />
          <BotonEntendido onClick={cerrarAviso} />
        </div>
      )}

      {vuelta === 'error' && (
        <div className="mb-4">
          <Aviso
            estado={{
              tipo: 'error',
              mensaje:
                MENSAJE_VUELTA[motivo ?? ''] ??
                'No pudimos conectar con Google. Probá de nuevo.',
            }}
          />
          <BotonEntendido onClick={cerrarAviso} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold ${
            conectado
              ? 'bg-brand-soft text-primary'
              : necesitaReconectar
                ? 'bg-warm-soft text-badge-tibio-ink'
                : 'bg-surface-2 text-ink-2'
          }`}
        >
          {conexion.isPending
            ? 'Verificando…'
            : conectado
              ? 'Conectado'
              : necesitaReconectar
                ? 'Reconexión pendiente'
                : 'No conectado'}
        </span>

        {necesitaReconectar && (
          <span className="text-[0.85rem] text-ink-3">
            Google dejó de aceptar el permiso. Volvé a conectar para retomar la sincronización.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => conectar.mutate()}
          disabled={conectar.isPending || conexion.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {conectar.isPending && (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
          )}
          {conectado ? 'Volver a conectar' : necesitaReconectar ? 'Reconectar' : 'Conectar Google Calendar'}
        </button>

        {/* Sólo cuando hay una conexión andando. En "reconexión pendiente" la
            fila todavía existe, pero al agente no le sirve desconectar: lo que
            quiere ahí es volver a conectar, y reconectar pisa la fila igual. */}
        {conectado && (
          <button
            type="button"
            onClick={() => setConfirmandoBaja(true)}
            disabled={desconectar.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Desconectar
          </button>
        )}
      </div>

      {/* Sólo con la conexión andando: sin token no hay nada que importar, y
          en "reconexión pendiente" lo que el agente tiene que hacer es
          reconectar. */}
      {conectado && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 max-w-[32rem]">
              <p className="m-0 text-[0.9rem] font-semibold text-ink">
                Importar mi calendario a LeadEra
              </p>
              <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-3">
                Vamos a traer los eventos de tu Google Calendar como tareas en
                LeadEra. Los eventos con el título “Visita: &lt;dirección&gt;” se
                cargan como visitas; el resto, como tareas. Podés desactivarlo
                cuando quieras.
              </p>
            </div>

            {/* `role="switch"` y no un checkbox: el control es el botón entero,
                con el estado en `aria-checked`. */}
            <button
              type="button"
              role="switch"
              aria-checked={importacionActiva}
              aria-label="Importar mi calendario a LeadEra"
              onClick={alternarImportacion}
              disabled={cambiarImportacion.isPending || conexion.isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                importacionActiva ? 'bg-primary' : 'bg-ink-4'
              }`}
            >
              <span
                aria-hidden
                className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${
                  importacionActiva ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* El error de apagar se muestra acá; el de prender vive dentro del
              modal, que es donde el agente está mirando. */}
          {cambiarImportacion.isError && !confirmandoImportacion && (
            <p className="mt-3">
              <Aviso estado={{ tipo: 'error', mensaje: cambiarImportacion.error.message }} />
            </p>
          )}

          {/* No es instantáneo: lo trae el cron, que corre cada pocos minutos. */}
          {avisoImportacion && importacionActiva && (
            <div className="mt-3">
              <Aviso
                estado={{
                  tipo: 'ok',
                  mensaje: 'Listo, la importación arranca en los próximos minutos.',
                }}
              />
              <BotonEntendido onClick={() => setAvisoImportacion(false)} />
            </div>
          )}
        </div>
      )}

      {confirmandoImportacion && (
        <ModalActivarImportacion
          activando={cambiarImportacion.isPending}
          error={cambiarImportacion.isError ? cambiarImportacion.error.message : null}
          onConfirmar={() =>
            cambiarImportacion.mutate(true, {
              onSuccess: () => {
                setConfirmandoImportacion(false)
                setAvisoImportacion(true)
              },
            })
          }
          onCancelar={() => {
            cambiarImportacion.reset()
            setConfirmandoImportacion(false)
          }}
        />
      )}

      {confirmandoBaja && (
        <ModalDesconectarGoogle
          desconectando={desconectar.isPending}
          // El error se muestra DENTRO del modal y no abajo de la tarjeta: si
          // falló, el agente sigue con el diálogo abierto y tiene que poder
          // decidir ahí mismo si reintenta o lo deja.
          error={desconectar.isError ? desconectar.error.message : null}
          onConfirmar={() =>
            desconectar.mutate(undefined, {
              onSuccess: () => setConfirmandoBaja(false),
            })
          }
          onCancelar={() => {
            // Limpia un error de un intento anterior: si vuelve a abrir el
            // modal, arranca en cero y no con el cartel rojo de la vez pasada.
            desconectar.reset()
            setConfirmandoBaja(false)
          }}
        />
      )}

      {conectar.isError && (
        <p className="mt-3">
          <Aviso estado={{ tipo: 'error', mensaje: conectar.error.message }} />
        </p>
      )}

      {conexion.isError && (
        <p className="mt-3 text-[0.85rem] text-ink-3">
          No pudimos verificar el estado de la conexión.
        </p>
      )}
    </Tarjeta>
  )
}

/** Cierra un aviso de vuelta del callback y le saca los params a la URL. */
function BotonEntendido({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-[0.82rem] font-semibold text-primary hover:underline"
    >
      Entendido
    </button>
  )
}

// ---------------------------------------------------------------------------
// Datos de la cuenta
// ---------------------------------------------------------------------------

interface DatosDeCuentaProps {
  nombreActual: string
  apellidoActual: string
  email: string
  rol: string
  deshabilitado: boolean
  alGuardar: () => Promise<void>
}

/** Nombre y apellido editables; email y rol de sólo lectura. */
function DatosDeCuenta({
  nombreActual,
  apellidoActual,
  email,
  rol,
  deshabilitado,
  alGuardar,
}: DatosDeCuentaProps) {
  const [nombre, setNombre] = useState(nombreActual)
  const [apellido, setApellido] = useState(apellidoActual)
  const [estado, setEstado] = useState<Estado>({ tipo: 'quieto' })

  const sinCambios =
    nombre.trim() === nombreActual && apellido.trim() === apellidoActual

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEstado({ tipo: 'enviando' })
    try {
      await actualizarDatosCuenta({ nombre, apellido })
      await alGuardar()
      setEstado({ tipo: 'ok', mensaje: 'Datos guardados.' })
    } catch (err) {
      setEstado({
        tipo: 'error',
        mensaje:
          err instanceof Error ? err.message : 'No se pudieron guardar tus datos.',
      })
    }
  }

  return (
    <Tarjeta
      titulo="Datos de la cuenta"
      descripcion="Así te ven tus compañeros de equipo dentro de LeadEra."
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Nombre"
            value={nombre}
            onChange={setNombre}
            autoComplete="given-name"
            required
            disabled={deshabilitado}
          />
          <CampoTexto
            label="Apellido"
            value={apellido}
            onChange={setApellido}
            autoComplete="family-name"
            required
            disabled={deshabilitado}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatoFijo label="Email" valor={email} ayuda="Es tu usuario para entrar." />
          <DatoFijo label="Rol" valor={rol} ayuda="Lo define quien te invitó." />
        </div>

        <Aviso estado={estado} />

        <Boton
          cargando={estado.tipo === 'enviando'}
          disabled={deshabilitado || sinCambios || !nombre.trim() || !apellido.trim()}
        >
          {estado.tipo === 'enviando' ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
      </form>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------------------
// Contraseña
// ---------------------------------------------------------------------------

function CambiarPassword() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [estado, setEstado] = useState<Estado>({ tipo: 'quieto' })

  const noCoinciden = repetida.length > 0 && nueva !== repetida

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (noCoinciden) return
    setEstado({ tipo: 'enviando' })
    try {
      await cambiarPassword({ actual, nueva })
      setActual('')
      setNueva('')
      setRepetida('')
      setEstado({ tipo: 'ok', mensaje: 'Contraseña actualizada.' })
    } catch (err) {
      setEstado({
        tipo: 'error',
        mensaje:
          err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.',
      })
    }
  }

  return (
    <Tarjeta
      titulo="Contraseña"
      descripcion={`Mínimo ${LARGO_MINIMO_PASSWORD} caracteres. Te pedimos la actual para confirmar que sos vos.`}
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <CampoTexto
          label="Contraseña actual"
          type="password"
          value={actual}
          onChange={setActual}
          autoComplete="current-password"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Contraseña nueva"
            type="password"
            value={nueva}
            onChange={setNueva}
            autoComplete="new-password"
            minLength={LARGO_MINIMO_PASSWORD}
            required
          />
          <CampoTexto
            label="Repetir la nueva"
            type="password"
            value={repetida}
            onChange={setRepetida}
            autoComplete="new-password"
            required
            invalido={noCoinciden}
            error={noCoinciden ? 'Las dos contraseñas tienen que coincidir.' : undefined}
          />
        </div>

        <Aviso estado={estado} />

        <Boton
          cargando={estado.tipo === 'enviando'}
          disabled={
            !actual || nueva.length < LARGO_MINIMO_PASSWORD || noCoinciden || !repetida
          }
        >
          {estado.tipo === 'enviando' ? 'Cambiando…' : 'Cambiar contraseña'}
        </Boton>
      </form>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------------------
// Piezas compartidas por las dos tarjetas
// ---------------------------------------------------------------------------

type Estado =
  | { tipo: 'quieto' }
  | { tipo: 'enviando' }
  | { tipo: 'ok'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

function Tarjeta({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <header className="mb-5">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">{titulo}</h2>
        <p className="mt-1 text-[0.85rem] text-ink-3">{descripcion}</p>
      </header>
      {children}
    </section>
  )
}

interface CampoTextoProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  required?: boolean
  disabled?: boolean
  minLength?: number
  invalido?: boolean
  error?: string
}

function CampoTexto({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required,
  disabled,
  minLength,
  invalido,
  error,
}: CampoTextoProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.85rem] font-semibold text-ink-2">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        minLength={minLength}
        aria-invalid={invalido || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'w-full rounded-xl border bg-surface-2 px-4 py-3 text-base text-ink',
          'transition-colors focus:bg-surface focus:shadow-focus focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
          invalido ? 'border-peligro-ink' : 'border-border focus:border-primary',
        ].join(' ')}
      />
      {error && (
        <span role="alert" className="text-xs text-peligro-ink">
          {error}
        </span>
      )}
    </label>
  )
}

function DatoFijo({
  label,
  valor,
  ayuda,
}: {
  label: string
  valor: string
  ayuda: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.85rem] font-semibold text-ink-2">{label}</span>
      <p className="m-0 truncate rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-base text-ink-3">
        {valor || '—'}
      </p>
      <span className="text-xs text-ink-3">{ayuda}</span>
    </div>
  )
}

function Aviso({ estado }: { estado: Estado }) {
  if (estado.tipo === 'error') {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-3.5 py-2.5 text-[0.85rem] text-peligro-ink"
      >
        {estado.mensaje}
      </p>
    )
  }

  if (estado.tipo === 'ok') {
    return (
      <p
        role="status"
        className="rounded-lg border border-border bg-badge-ganado-bg px-3.5 py-2.5 text-[0.85rem] font-semibold text-primary-dark"
      >
        {estado.mensaje}
      </p>
    )
  }

  return null
}

function Boton({
  cargando,
  disabled,
  children,
}: {
  cargando?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled || cargando}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
    >
      {cargando && (
        <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
      )}
      {children}
    </button>
  )
}
