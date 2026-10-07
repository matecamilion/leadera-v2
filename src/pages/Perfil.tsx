import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import {
  useConectarGoogle,
  useCambiarImportacionGoogle,
  useConexionGoogle,
  useDesconectarGoogle,
} from '../hooks/useGoogleCalendar'
import { PasswordInput } from '../components/ui/PasswordInput'
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

const ETIQUETA_ROL: Record<string, string> = {
  DUENO: 'Dueño',
  AGENTE: 'Agente',
  ASISTENTE: 'Asistente',
}

type Seccion = 'cuenta' | 'seguridad' | 'plan' | 'integraciones' | 'notificaciones'

const SECCIONES: { id: Seccion; label: string; soloDueno?: boolean }[] = [
  { id: 'cuenta', label: 'Mi cuenta' },
  { id: 'seguridad', label: 'Seguridad' },
  // El plan es de la inmobiliaria entera y sólo el dueño lo contrata o lo cambia.
  { id: 'plan', label: 'Plan y facturación', soloDueno: true },
  { id: 'integraciones', label: 'Integraciones' },
  { id: 'notificaciones', label: 'Notificaciones' },
]

/**
 * Qué sección mostrar, desde la URL.
 *
 * `?seccion=` es el parámetro propio. `?tab=` se acepta como sinónimo, por si
 * algún link lo usa. Y si viene `?google=` (la vuelta del consentimiento de
 * Google Calendar, que redirige a /perfil) se abre Integraciones, que es donde
 * está el aviso del resultado: antes la pantalla abría en "Mi cuenta" y ese
 * aviso no se veía.
 */
function leerSeccion(params: URLSearchParams, esDueno: boolean): Seccion {
  const pedida = params.get('seccion') ?? params.get('tab')
  const valida = SECCIONES.find((s) => s.id === pedida && (!s.soloDueno || esDueno))
  if (valida) return valida.id
  if (params.has('google')) return 'integraciones'
  return 'cuenta'
}

/**
 * Configuración: menú de secciones a la izquierda y filas de ajustes a la
 * derecha. La ruta sigue siendo /perfil: es la que tiene configurada el
 * callback de Google Calendar y la que pueden tener guardada los usuarios.
 */
export default function Perfil() {
  const { user, profile, refrescarPerfil } = useAuth()
  const [params, setParams] = useSearchParams()

  const nombre = profile?.nombre ?? ''
  const apellido = profile?.apellido ?? ''
  const rol = profile ? (ETIQUETA_ROL[profile.rol] ?? profile.rol) : ''

  // Mientras `profile` carga es null y el chequeo da false: Plan y facturación
  // aparece recién cuando sabemos el rol, nunca antes.
  const esDueno = profile?.rol === 'DUENO'
  const activa = leerSeccion(params, esDueno)
  const secciones = SECCIONES.filter((s) => !s.soloDueno || esDueno)

  /** Cambia de sección. Con `replace`: moverse entre secciones no es historial. */
  function irA(seccion: Seccion) {
    setParams(
      (previos) => {
        const proximos = new URLSearchParams(previos)
        proximos.delete('tab')
        if (seccion === 'cuenta') proximos.delete('seccion')
        else proximos.set('seccion', seccion)
        return proximos
      },
      { replace: true },
    )
  }

  return (
    <div className="max-w-[1000px]">
      <h1 className="m-0 mb-6 text-[1.6rem] leading-tight font-bold text-ink">Configuración</h1>

      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
        {/* Mobile: fila horizontal que scrollea. md+: columna fija. */}
        <nav aria-label="Secciones de configuración" className="min-w-0">
          <ul className="-mx-1 m-0 flex list-none gap-1 overflow-x-auto p-1 [scrollbar-width:none] md:sticky md:top-20 md:mx-0 md:flex-col md:overflow-visible md:p-0 [&::-webkit-scrollbar]:hidden">
            {secciones.map((s) => {
              const actual = s.id === activa
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => irA(s.id)}
                    aria-current={actual ? 'page' : undefined}
                    className={[
                      'flex h-9 w-full items-center rounded-lg px-3 text-left text-[0.88rem] whitespace-nowrap',
                      'transition-colors motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      actual
                        ? 'bg-brand-soft font-semibold text-primary'
                        : 'font-medium text-ink-2 hover:bg-surface-muted hover:text-ink',
                    ].join(' ')}
                  >
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Cada sección monta sólo lo suyo: lo que no se ve no pide datos ni
            queda con estado a medio llenar. */}
        <div className="min-w-0 max-w-[720px]">
          {activa === 'cuenta' && (
            // El borrador arranca del profile; el key lo remonta cuando el
            // profile cambia de verdad, así un refetch no pisa lo tipeado.
            <DatosDeCuenta
              key={`${nombre}|${apellido}`}
              nombreActual={nombre}
              apellidoActual={apellido}
              email={user?.email ?? ''}
              rol={rol}
              deshabilitado={profile == null}
              alGuardar={refrescarPerfil}
            />
          )}

          {activa === 'seguridad' && <CambiarPassword />}

          {activa === 'plan' && esDueno && <PlanYFacturacion />}

          {activa === 'integraciones' && <GoogleCalendar />}

          {activa === 'notificaciones' && <NotificacionesPorEmail />}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piezas de layout: sección y fila de ajuste
// ---------------------------------------------------------------------------

/** Encabezado de la sección y sus filas, separadas por líneas finas. */
function BloqueSeccion({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
  /** Lo que va abajo de las filas: botones de guardar, avisos. */
  pie?: ReactNode
}) {
  return (
    <section>
      <header className="mb-2">
        <h2 className="m-0 text-[1.1rem] font-bold text-ink">{titulo}</h2>
        <p className="mt-1 mb-0 text-[0.88rem] text-ink-3">{descripcion}</p>
      </header>
      <div className="divide-y divide-border border-b border-border">{children}</div>
      {pie && <div className="mt-5">{pie}</div>}
    </section>
  )
}

/**
 * Un ajuste: qué es y qué implica a la izquierda, el control a la derecha. En
 * mobile, el control baja abajo del texto.
 */
function FilaAjuste({
  titulo,
  descripcion,
  htmlFor,
  children,
}: {
  titulo: string
  descripcion?: ReactNode
  /** Si el control es un input, el título hace de label. */
  htmlFor?: string
  children: ReactNode
}) {
  const Titulo = htmlFor ? 'label' : 'p'
  return (
    <div className="grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center">
      <div className="min-w-0">
        <Titulo
          {...(htmlFor ? { htmlFor } : {})}
          className="m-0 block text-[0.9rem] font-semibold text-ink"
        >
          {titulo}
        </Titulo>
        {descripcion && (
          <p className="mt-1 mb-0 text-[0.84rem] leading-relaxed text-ink-3">{descripcion}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

const BOTON_PRIMARIO =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[0.88rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

const BOTON_SECUNDARIO =
  'inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-[0.88rem] font-semibold text-ink-2 transition-colors hover:bg-background hover:text-ink disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

/** Rueda de "guardando" para adentro de un botón de marca. */
function Girando() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-primary-contrast/40 border-t-primary-contrast motion-reduce:animate-none"
    />
  )
}

/**
 * "Guardar cambios" (apagado hasta que haya algo para guardar) y "Descartar"
 * al lado, sólo cuando hay cambios.
 */
function BarraGuardar({
  hayCambios,
  puedeGuardar,
  guardando,
  textoGuardar = 'Guardar cambios',
  textoGuardando = 'Guardando…',
  onDescartar,
}: {
  hayCambios: boolean
  puedeGuardar: boolean
  guardando: boolean
  textoGuardar?: string
  textoGuardando?: string
  onDescartar: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" disabled={!hayCambios || !puedeGuardar || guardando} className={BOTON_PRIMARIO}>
        {guardando && <Girando />}
        {guardando ? textoGuardando : textoGuardar}
      </button>
      {hayCambios && !guardando && (
        <button type="button" onClick={onDescartar} className={BOTON_SECUNDARIO}>
          Descartar
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mi cuenta
// ---------------------------------------------------------------------------

interface DatosDeCuentaProps {
  nombreActual: string
  apellidoActual: string
  email: string
  rol: string
  deshabilitado: boolean
  alGuardar: () => Promise<void>
}

/** Nombre y apellido editables; email y rol de sólo lectura, como texto. */
function DatosDeCuenta({
  nombreActual,
  apellidoActual,
  email,
  rol,
  deshabilitado,
  alGuardar,
}: DatosDeCuentaProps) {
  const id = useId()
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

  function descartar() {
    setNombre(nombreActual)
    setApellido(apellidoActual)
    setEstado({ tipo: 'quieto' })
  }

  return (
    <form onSubmit={enviar} noValidate>
      <BloqueSeccion
        titulo="Mi cuenta"
        descripcion="Así te ven tus compañeros de equipo dentro de LeadEra."
        pie={
          <div className="space-y-3">
            <Aviso estado={estado} />
            <BarraGuardar
              hayCambios={!sinCambios}
              puedeGuardar={!deshabilitado && Boolean(nombre.trim()) && Boolean(apellido.trim())}
              guardando={estado.tipo === 'enviando'}
              onDescartar={descartar}
            />
          </div>
        }
      >
        <FilaAjuste titulo="Nombre" htmlFor={`${id}-nombre`}>
          <CampoTexto
            id={`${id}-nombre`}
            value={nombre}
            onChange={setNombre}
            autoComplete="given-name"
            required
            disabled={deshabilitado}
          />
        </FilaAjuste>
        <FilaAjuste titulo="Apellido" htmlFor={`${id}-apellido`}>
          <CampoTexto
            id={`${id}-apellido`}
            value={apellido}
            onChange={setApellido}
            autoComplete="family-name"
            required
            disabled={deshabilitado}
          />
        </FilaAjuste>
        <FilaAjuste titulo="Email" descripcion="Es tu usuario para entrar. No se puede cambiar desde acá.">
          <p className="m-0 truncate text-[0.92rem] text-ink">{email || '—'}</p>
        </FilaAjuste>
        <FilaAjuste titulo="Rol" descripcion="Lo define quien te invitó a la inmobiliaria.">
          <p className="m-0 text-[0.92rem] text-ink">{rol || '—'}</p>
        </FilaAjuste>
      </BloqueSeccion>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Seguridad
// ---------------------------------------------------------------------------

function CambiarPassword() {
  const id = useId()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [estado, setEstado] = useState<Estado>({ tipo: 'quieto' })

  const noCoinciden = repetida.length > 0 && nueva !== repetida
  const hayCambios = Boolean(actual || nueva || repetida)

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

  function descartar() {
    setActual('')
    setNueva('')
    setRepetida('')
    setEstado({ tipo: 'quieto' })
  }

  return (
    <form onSubmit={enviar} noValidate>
      <BloqueSeccion
        titulo="Seguridad"
        descripcion="Cambiá la contraseña con la que entrás a LeadEra."
        pie={
          <div className="space-y-3">
            <Aviso estado={estado} />
            <BarraGuardar
              hayCambios={hayCambios}
              puedeGuardar={
                Boolean(actual) && nueva.length >= LARGO_MINIMO_PASSWORD && !noCoinciden && Boolean(repetida)
              }
              guardando={estado.tipo === 'enviando'}
              textoGuardar="Cambiar contraseña"
              textoGuardando="Cambiando…"
              onDescartar={descartar}
            />
          </div>
        }
      >
        <FilaAjuste
          titulo="Contraseña actual"
          descripcion="Te la pedimos para confirmar que sos vos."
          htmlFor={`${id}-actual`}
        >
          <CampoTexto
            id={`${id}-actual`}
            type="password"
            value={actual}
            onChange={setActual}
            autoComplete="current-password"
            required
          />
        </FilaAjuste>
        <FilaAjuste
          titulo="Contraseña nueva"
          descripcion={`Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.`}
          htmlFor={`${id}-nueva`}
        >
          <CampoTexto
            id={`${id}-nueva`}
            type="password"
            value={nueva}
            onChange={setNueva}
            autoComplete="new-password"
            minLength={LARGO_MINIMO_PASSWORD}
            required
          />
        </FilaAjuste>
        <FilaAjuste titulo="Repetir la nueva" htmlFor={`${id}-repetida`}>
          <CampoTexto
            id={`${id}-repetida`}
            type="password"
            value={repetida}
            onChange={setRepetida}
            autoComplete="new-password"
            required
            invalido={noCoinciden}
            error={noCoinciden ? 'Las dos contraseñas tienen que coincidir.' : undefined}
          />
        </FilaAjuste>
      </BloqueSeccion>
    </form>
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
 * El acceso del dueño a /suscripcion, que es el único lugar donde se ve y se
 * gestiona el plan. Acá no se repite nada de esa pantalla: sólo el resumen,
 * si se puede leer —hoy `inmobiliarias` no tiene policy de SELECT para
 * usuarios autenticados, así que la fila vuelve vacía y queda sólo el link—.
 */
function PlanYFacturacion() {
  const estado = useEstadoSuscripcion()
  const datos = estado.data ?? null
  const detalle = datos?.plan ? DETALLE_PLAN[datos.plan] : null

  return (
    <BloqueSeccion
      titulo="Plan y facturación"
      descripcion="El plan de tu inmobiliaria y cómo se cobra."
    >
      <FilaAjuste
        titulo="Plan de la inmobiliaria"
        descripcion="Cambiá de plan, mirá el uso y el historial de pagos, o dá de baja la suscripción."
      >
        <div className="flex flex-wrap items-center gap-3">
          {datos && (
            <>
              <span className="text-[0.92rem] font-semibold text-ink">
                {detalle ? `Plan ${detalle.nombre}` : 'Sin plan contratado'}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold ${TONO_ESTADO[datos.estado]}`}
              >
                {ETIQUETA_ESTADO[datos.estado]}
              </span>
            </>
          )}
          <Link to="/suscripcion" className={BOTON_SECUNDARIO}>
            Ver plan y facturación →
          </Link>
        </div>
      </FilaAjuste>
    </BloqueSeccion>
  )
}

// ---------------------------------------------------------------------------
// Integraciones: Google Calendar
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
 * La ve cualquier rol: la agenda es de cada uno, no de la inmobiliaria.
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
  // mostrar como si el agente acabara de conectar. Se deja la sección puesta,
  // porque sin `?google=` la página volvería a abrir en "Mi cuenta".
  const cerrarAviso = () => {
    const limpio = new URLSearchParams(params)
    limpio.delete('google')
    limpio.delete('motivo')
    limpio.set('seccion', 'integraciones')
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
    <>
    <BloqueSeccion
      titulo="Integraciones"
      descripcion="Conectá LeadEra con las herramientas que ya usás."
    >
      <div className="py-5">
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

        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 text-[0.9rem] font-semibold text-ink">Google Calendar</p>
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
            </div>
            <p className="mt-1 mb-0 text-[0.84rem] leading-relaxed text-ink-3">
              {necesitaReconectar
                ? 'Google dejó de aceptar el permiso. Volvé a conectar para retomar la sincronización.'
                : 'Tus tareas y visitas aparecen como eventos en tu calendario de Google.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Desconectar sólo con una conexión andando. En "reconexión
                pendiente" la fila todavía existe, pero al agente no le sirve
                desconectar: lo que quiere es volver a conectar, y reconectar
                pisa la fila igual. */}
            {conectado && (
              <button
                type="button"
                onClick={() => setConfirmandoBaja(true)}
                disabled={desconectar.isPending}
                className={BOTON_SECUNDARIO}
              >
                Desconectar
              </button>
            )}
            <button
              type="button"
              onClick={() => conectar.mutate()}
              disabled={conectar.isPending || conexion.isPending}
              className={conectado ? BOTON_SECUNDARIO : BOTON_PRIMARIO}
            >
              {conectar.isPending && (conectado ? <GirandoNeutro /> : <Girando />)}
              {conectado ? 'Volver a conectar' : necesitaReconectar ? 'Reconectar' : 'Conectar'}
            </button>
          </div>
        </div>

        {conectar.isError && (
          <div className="mt-3 mb-0">
            <Aviso estado={{ tipo: 'error', mensaje: conectar.error.message }} />
          </div>
        )}

        {conexion.isError && (
          <p className="mt-3 mb-0 text-[0.85rem] text-ink-3">
            No pudimos verificar el estado de la conexión.
          </p>
        )}
      </div>

      {/* Sólo con la conexión andando: sin token no hay nada que importar, y
          en "reconexión pendiente" lo que el agente tiene que hacer es
          reconectar. */}
      {conectado && (
        <div>
          <FilaAjuste
            titulo="Importar mi calendario a LeadEra"
            descripcion={
              <>
                Trae los eventos de tu Google Calendar como tareas. Los que se
                llaman “Visita: &lt;dirección&gt;” se cargan como visitas.
                Podés desactivarlo cuando quieras.
              </>
            }
          >
            <div className="flex sm:justify-end">
              <Interruptor
                encendido={importacionActiva}
                etiqueta="Importar mi calendario a LeadEra"
                deshabilitado={cambiarImportacion.isPending || conexion.isPending}
                onAlternar={alternarImportacion}
              />
            </div>
          </FilaAjuste>

          {/* El error de apagar se muestra acá; el de prender vive dentro del
              modal, que es donde el agente está mirando. */}
          {cambiarImportacion.isError && !confirmandoImportacion && (
            <div className="mt-0 mb-5">
              <Aviso estado={{ tipo: 'error', mensaje: cambiarImportacion.error.message }} />
            </div>
          )}

          {/* No es instantáneo: lo trae el cron, que corre cada pocos minutos. */}
          {avisoImportacion && importacionActiva && (
            <div className="mb-5">
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
    </BloqueSeccion>

      {/* Los modales van fuera de la sección: adentro, el `divide-y` de las
          filas les sumaría un borde. */}
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
          // El error se muestra DENTRO del modal: si falló, el agente sigue
          // con el diálogo abierto y decide ahí mismo si reintenta o lo deja.
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
    </>
  )
}

/** La rueda para un botón neutro (borde y fondo de superficie). */
function GirandoNeutro() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-ink-4/40 border-t-ink-3 motion-reduce:animate-none"
    />
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
// Notificaciones
// ---------------------------------------------------------------------------

/**
 * Las notificaciones que llegan por mail. Hoy hay una sola —el reporte
 * semanal—; la próxima entra como otra fila.
 */
function NotificacionesPorEmail() {
  return (
    <BloqueSeccion
      titulo="Notificaciones"
      descripcion="Elegí qué querés recibir en tu casilla de correo."
    >
      <FilaReporteSemanal />
    </BloqueSeccion>
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
    <div>
      <FilaAjuste
        titulo="Reporte semanal"
        descripcion="Te llega a tu email todos los lunes a las 9 de la mañana. Podés desactivarlo cuando quieras."
      >
        <div className="flex sm:justify-end">
          <Interruptor
            encendido={encendido}
            etiqueta="Recibir el reporte semanal"
            deshabilitado={cambiar.isPending || isPending}
            onAlternar={alternar}
          />
        </div>
      </FilaAjuste>

      {/* El error de apagar se muestra en la fila; el de prender vive dentro
          del modal, que es donde el agente está mirando. */}
      {cambiar.isError && !confirmando && (
        <div className="mt-0 mb-5">
          <Aviso estado={{ tipo: 'error', mensaje: cambiar.error.message }} />
        </div>
      )}

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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Controles compartidos
// ---------------------------------------------------------------------------

type Estado =
  | { tipo: 'quieto' }
  | { tipo: 'enviando' }
  | { tipo: 'ok'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

/**
 * El switch de prender y apagar, con la misma forma en todas partes. La
 * perilla es `bg-surface` y no blanca fija: en claro es blanca igual, y en
 * oscuro contrasta con el verde claro del modo oscuro.
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
        className={`inline-block size-5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none ${
          encendido ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

interface CampoTextoProps {
  id: string
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

/** Input de 40px. La label la pone la fila (`FilaAjuste` con `htmlFor`). */
function CampoTexto({
  id,
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
  const propsInput = {
    id,
    value,
    autoComplete,
    required,
    disabled,
    minLength,
    'aria-invalid': invalido || undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    className: [
      'h-10 w-full rounded-lg border bg-surface px-3 text-[0.92rem] text-ink',
      'transition-colors focus:shadow-focus focus:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
      invalido ? 'border-peligro-ink' : 'border-border focus:border-primary',
    ].join(' '),
  }

  return (
    <div className="flex flex-col gap-1.5">
      {type === 'password' ? (
        // `block`: adentro del wrapper de PasswordInput el input ya no es un
        // flex item, y como inline dejaría el hueco de la línea de base abajo,
        // descentrando el ojito.
        <PasswordInput {...propsInput} className={`block ${propsInput.className}`} />
      ) : (
        <input type={type} {...propsInput} />
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-peligro-ink">
          {error}
        </span>
      )}
    </div>
  )
}

function Aviso({ estado }: { estado: Estado }) {
  if (estado.tipo === 'error') {
    return (
      <p
        role="alert"
        className="m-0 rounded-lg border border-peligro-borde bg-peligro-soft px-3.5 py-2.5 text-[0.85rem] text-peligro-ink"
      >
        {estado.mensaje}
      </p>
    )
  }

  if (estado.tipo === 'ok') {
    return (
      <p
        role="status"
        className="m-0 rounded-lg border border-border bg-badge-ganado-bg px-3.5 py-2.5 text-[0.85rem] font-semibold text-primary-dark"
      >
        {estado.mensaje}
      </p>
    )
  }

  return null
}
