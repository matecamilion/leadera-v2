import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'
import { BotonPrimario, Campo, MensajeError } from '../components/Campo'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, signup, type SignupInput } from '../lib/api/auth'
import { DETALLE_PLAN, PLANES, type Plan } from '../lib/api/suscripcion'
import { supabase } from '../lib/supabase'

/**
 * Alta de cuenta.
 *
 * Dos caminos distintos, y a propósito:
 *
 *  - Independiente: un flujo de pasos que arranca preguntando cómo va a usar
 *    LeadEra y termina con un plan elegido. No cobra nada —el trial de 14 días
 *    sigue igual—, pero deja registrado contra qué plan se está midiendo la
 *    inmobiliaria desde el día uno.
 *  - Invitado: el formulario de siempre, en un paso. Quien entra por un link se
 *    suma a una inmobiliaria que ya tiene plan, elegido por su dueño; el
 *    backend además ignora cualquier plan que mande un invitado.
 *
 * El flujo vive en el estado de este componente y no en rutas propias: los
 * datos a medio cargar no sobrevivirían a un refresh de todos modos, así que
 * una URL por paso prometería una vuelta atrás que no existe.
 */
export default function Signup() {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()

  // El token de invitación llega por la URL: /signup?invite=<token>
  const invite = searchParams.get('invite')?.trim() || null

  // Terminado el alta ya hay sesión, y el redirect de abajo se llevaría puesta
  // la pantalla de bienvenida antes de que llegue a verse.
  const [registroListo, setRegistroListo] = useState(false)

  if (loading) return <Spinner fullscreen />
  if (user && !registroListo) return <Navigate to="/mi-dia" replace />

  if (invite !== null) return <AltaInvitado token={invite} />

  return <AltaIndependiente onRegistrado={() => setRegistroListo(true)} />
}

// ---------------------------------------------------------------------------
// Alta independiente: el flujo de pasos
// ---------------------------------------------------------------------------

type Modo = 'solo' | 'equipo'

type IdPaso = 'modo' | 'agentes' | 'plan' | 'datos' | 'listo'

/**
 * Los pasos de cada rama.
 *
 * "Solo yo" son cuatro y no cinco: el plan sale directo de la respuesta y no
 * hay nada que preguntar sobre el tamaño del equipo. El contador dice el total
 * real en lugar de anunciar cinco y saltearse uno.
 */
const PASOS: Record<Modo, IdPaso[]> = {
  solo: ['modo', 'plan', 'datos', 'listo'],
  equipo: ['modo', 'agentes', 'plan', 'datos', 'listo'],
}

/** A partir de acá el equipo ya no entra en Agencia Chica. */
const TOPE_AGENCIA_CHICA = 5

function planSugerido(modo: Modo, agentes: number): Plan {
  if (modo === 'solo') return 'SOLO'
  return agentes > TOPE_AGENCIA_CHICA ? 'AGENCIA_GRANDE' : 'AGENCIA_CHICA'
}

const TITULOS: Record<Exclude<IdPaso, 'listo'>, { titulo: string; descripcion: string }> = {
  modo: {
    titulo: '¿Cómo vas a usar LeadEra?',
    descripcion: 'Con esto te sugerimos el plan que mejor te queda. Podés cambiarlo.',
  },
  agentes: {
    titulo: '¿Cuántos agentes son en total?',
    descripcion: 'Contando a todos los que van a cargar leads y propiedades, vos incluido.',
  },
  plan: {
    titulo: 'Te sugerimos este plan',
    descripcion: 'Arrancás con 14 días gratis. No te pedimos tarjeta para empezar.',
  },
  datos: {
    titulo: 'Creá tu inmobiliaria',
    descripcion: 'Últimos datos y ya entrás.',
  },
}

function AltaIndependiente({ onRegistrado }: { onRegistrado: () => void }) {
  const navigate = useNavigate()

  // Arranca sin elegir: preseleccionar una de las dos empujaría la respuesta,
  // que es justo lo que este paso viene a preguntar. Hasta que haya elección el
  // contador asume la rama corta, y se corrige apenas la persona toca una.
  const [modo, setModo] = useState<Modo | null>(null)
  const [indice, setIndice] = useState(0)
  const [agentes, setAgentes] = useState('2')
  // null hasta que el usuario elige a mano: así, si vuelve atrás y cambia el
  // tamaño del equipo, la sugerencia se recalcula en vez de quedar pegada a la
  // primera respuesta.
  const [planElegido, setPlanElegido] = useState<Plan | null>(null)

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [nombreInmobiliaria, setNombreInmobiliaria] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // El total sale del modo elegido en este momento, no del que estaba vigente
  // al avanzar: si la persona vuelve al paso 1 y cambia de idea, el contador
  // tiene que decir el total nuevo antes de que siga adelante.
  const pasos = PASOS[modo ?? 'solo']
  const paso = pasos[indice]
  const sugerido = planSugerido(modo ?? 'solo', Number(agentes) || 1)
  const plan = planElegido ?? sugerido

  function avanzar() {
    setError(null)
    setIndice((i) => Math.min(i + 1, pasos.length - 1))
  }

  function retroceder() {
    setError(null)
    setIndice((i) => Math.max(i - 1, 0))
  }

  function elegirModo(nuevo: Modo) {
    setModo(nuevo)
    // La rama cambió: una elección manual de plan hecha antes ya no responde a
    // lo que la persona acaba de decir.
    setPlanElegido(null)
    // Un click elige y avanza. Separarlo en dos dejaría ver el contador
    // recalculado antes de seguir, pero eso sólo lo nota quien vuelve atrás a
    // cambiar de idea, y no justifica un click de más para todos los que se
    // registran derecho.
    setIndice(1)
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const input: SignupInput = {
      tipo: 'independiente',
      email,
      password,
      nombre,
      apellido,
      nombre_inmobiliaria: nombreInmobiliaria,
      plan,
    }

    try {
      const resultado = await signup(input)

      if (resultado.session) {
        const { error: errorSesion } = await supabase.auth.setSession({
          access_token: resultado.session.access_token,
          refresh_token: resultado.session.refresh_token,
        })
        if (!errorSesion) {
          // Se avisa hacia arriba para que el redirect automático no se lleve
          // puesta la bienvenida, y recién ahí se pasa al último paso.
          onRegistrado()
          setIndice(pasos.length - 1)
          return
        }
      }

      navigate('/login', {
        replace: true,
        state: { aviso: 'Cuenta creada, iniciá sesión' },
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
      setEnviando(false)
    }
  }

  if (paso === 'listo') {
    return (
      <AuthShell
        titulo="¡Listo! Tu cuenta está creada"
        descripcion={`Tenés 14 días gratis para probar LeadEra con el plan ${DETALLE_PLAN[plan].nombre}. No te pedimos ningún medio de pago.`}
      >
        <button
          type="button"
          onClick={() => navigate('/mi-dia', { replace: true })}
          className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
        >
          Empezar a usar LeadEra
        </button>

        <p className="mt-4 text-center text-xs text-ink-subtle">
          Cuando se termine la prueba vas a poder elegir cómo seguir desde Suscripción.
          Hasta entonces no se te cobra nada.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      titulo={TITULOS[paso].titulo}
      descripcion={TITULOS[paso].descripcion}
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <Progreso actual={indice + 1} total={pasos.length} />

      {error && (
        <div className="mb-4">
          <MensajeError>{error}</MensajeError>
        </div>
      )}

      {paso === 'modo' && (
        <div className="space-y-3">
          <OpcionModo
            titulo="Solo yo"
            detalle="Trabajo por mi cuenta, sin equipo."
            seleccionado={modo === 'solo'}
            onClick={() => elegirModo('solo')}
          />
          <OpcionModo
            titulo="Con mi equipo"
            detalle="Somos varios cargando leads y propiedades."
            seleccionado={modo === 'equipo'}
            onClick={() => elegirModo('equipo')}
          />
        </div>
      )}

      {paso === 'agentes' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            avanzar()
          }}
          className="space-y-4"
          noValidate
        >
          <Campo
            label="Cantidad de agentes"
            type="number"
            name="agentes"
            inputMode="numeric"
            min={1}
            required
            value={agentes}
            onChange={(e) => {
              setAgentes(e.target.value)
              // Cambió el tamaño del equipo: vuelve a mandar la sugerencia.
              setPlanElegido(null)
            }}
          />
          <BotonPrimario disabled={!agentes || Number(agentes) < 1}>Continuar</BotonPrimario>
          <BotonAtras onClick={retroceder} />
        </form>
      )}

      {paso === 'plan' && (
        <div>
          <ul className="m-0 list-none space-y-3 p-0">
            {PLANES.map((opcion) => (
              <OpcionPlan
                key={opcion}
                plan={opcion}
                esSugerido={opcion === sugerido}
                seleccionado={opcion === plan}
                onSeleccionar={() => setPlanElegido(opcion)}
              />
            ))}
          </ul>

          {/* Las tarjetas son grandes y llegan hasta el borde: sin este aire de
              por medio el botón parece una cuarta opción de la lista. */}
          <div className="mt-6 space-y-4">
            <BotonPrimario type="button" onClick={avanzar}>
              Seguir con {DETALLE_PLAN[plan].nombre}
            </BotonPrimario>
            <BotonAtras onClick={retroceder} />
          </div>
        </div>
      )}

      {paso === 'datos' && (
        <form onSubmit={registrar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Nombre"
              name="nombre"
              autoComplete="given-name"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Campo
              label="Apellido"
              name="apellido"
              autoComplete="family-name"
              required
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </div>

          <Campo
            label="Nombre de la inmobiliaria"
            name="nombre_inmobiliaria"
            autoComplete="organization"
            required
            value={nombreInmobiliaria}
            onChange={(e) => setNombreInmobiliaria(e.target.value)}
          />

          <Campo
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <Campo
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-ink-subtle">Mínimo 8 caracteres.</p>
          </div>

          <BotonPrimario cargando={enviando}>
            {enviando ? 'Creando la cuenta…' : 'Crear cuenta'}
          </BotonPrimario>
          {!enviando && <BotonAtras onClick={retroceder} />}
        </form>
      )}
    </AuthShell>
  )
}

// ---------------------------------------------------------------------------
// Piezas del flujo
// ---------------------------------------------------------------------------

function Progreso({ actual, total }: { actual: number; total: number }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-xs font-medium text-ink-subtle">
        Paso {actual} de {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={actual}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Paso ${actual} de ${total}`}
        className="h-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(actual / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

function BotonAtras({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      Atrás
    </button>
  )
}

function OpcionModo({
  titulo,
  detalle,
  seleccionado,
  onClick,
}: {
  titulo: string
  detalle: string
  seleccionado: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={seleccionado}
      className={[
        'block w-full rounded-md border px-4 py-3.5 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'motion-reduce:transition-none',
        // Mismo tratamiento que las tarjetas de plan, para que "elegido" se lea
        // igual en los dos pasos donde hay algo que elegir.
        seleccionado
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-surface hover:border-ink-subtle',
      ].join(' ')}
    >
      <span className="block text-sm font-semibold text-ink">{titulo}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{detalle}</span>
    </button>
  )
}

/**
 * Un plan como opción elegible.
 *
 * El copy sale de `DETALLE_PLAN`, el mismo que usa /suscripcion: si cambia lo
 * que promete un plan, no puede decir una cosa en el alta y otra en la pantalla
 * de suscripción.
 */
function OpcionPlan({
  plan,
  esSugerido,
  seleccionado,
  onSeleccionar,
}: {
  plan: Plan
  esSugerido: boolean
  seleccionado: boolean
  onSeleccionar: () => void
}) {
  const detalle = DETALLE_PLAN[plan]

  return (
    <li>
      <button
        type="button"
        onClick={onSeleccionar}
        aria-pressed={seleccionado}
        className={[
          'block w-full rounded-md border px-4 py-3.5 text-left transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'motion-reduce:transition-none',
          seleccionado
            ? 'border-primary bg-primary-soft'
            : 'border-border bg-surface hover:border-ink-subtle',
        ].join(' ')}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">{detalle.nombre}</span>
          {esSugerido && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">
              Sugerido
            </span>
          )}
        </span>

        <span className="mt-0.5 block text-xs text-ink-muted">{detalle.bajada}</span>

        <ul className="mt-2 mb-0 list-none space-y-1 p-0">
          {detalle.incluye.map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-xs text-ink-2">
              <span aria-hidden className="mt-[3px] shrink-0 text-primary">
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
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Alta invitado: sin pasos
// ---------------------------------------------------------------------------

function AltaInvitado({ token }: { token: string }) {
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    // El rol, la inmobiliaria y el asiste_a de un invitado los define el token
    // del lado del servidor. Acá sólo mandamos el token y los datos personales.
    try {
      const resultado = await signup({
        tipo: 'invitado',
        token,
        email,
        password,
        nombre,
        apellido,
      })

      if (resultado.session) {
        const { error: errorSesion } = await supabase.auth.setSession({
          access_token: resultado.session.access_token,
          refresh_token: resultado.session.refresh_token,
        })
        if (!errorSesion) {
          navigate('/mi-dia', { replace: true })
          return
        }
      }

      navigate('/login', {
        replace: true,
        state: { aviso: 'Cuenta creada, iniciá sesión' },
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
      setEnviando(false)
    }
  }

  return (
    <AuthShell
      titulo="Sumate a tu equipo"
      descripcion="Te invitaron a LeadEra. Completá tus datos para activar tu cuenta."
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={manejarSubmit} className="space-y-4" noValidate>
        {error && <MensajeError>{error}</MensajeError>}

        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Nombre"
            name="nombre"
            autoComplete="given-name"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            label="Apellido"
            name="apellido"
            autoComplete="family-name"
            required
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
          />
        </div>

        <Campo
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <Campo
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-ink-subtle">Mínimo 8 caracteres.</p>
        </div>

        <BotonPrimario cargando={enviando}>
          {enviando ? 'Creando la cuenta…' : 'Crear cuenta'}
        </BotonPrimario>
      </form>
    </AuthShell>
  )
}
