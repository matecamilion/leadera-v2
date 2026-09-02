import { useId, useState, type CSSProperties, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BotonPrimario, MensajeError } from '../components/Campo'
import { Marca } from '../components/Marca'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import fotoHero from '../assets/login-hero.jpg'

interface EstadoNavegacion {
  /** Ruta protegida a la que el usuario quería entrar antes del login. */
  from?: string
  /** Aviso que dejó otra pantalla, ej. el alta al no devolver sesión. */
  aviso?: string
}

/** Mitad del lado del aura: el centro se corre para que quede bajo el cursor. */
const RADIO_AURA = 250

/**
 * Degradé sobre la foto para que el texto blanco se lea.
 *
 * Las paradas son las del login de Angular, pero el teal sale de
 * `--color-sidebar` —la superficie oscura de marca— en vez del hex suelto que
 * usaba el original.
 */
const SCRIM = `linear-gradient(
  180deg,
  color-mix(in srgb, var(--color-sidebar) 82%, transparent) 0%,
  color-mix(in srgb, var(--color-sidebar) 35%, transparent) 32%,
  color-mix(in srgb, var(--color-sidebar) 5%, transparent) 55%,
  color-mix(in srgb, var(--color-sidebar) 55%, transparent) 100%
)`

export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const estado = (location.state ?? {}) as EstadoNavegacion

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Posición del aura, relativa al panel del form. `null` mientras el mouse
  // está afuera: así no se pinta en la esquina antes del primer movimiento.
  const [aura, setAura] = useState<{ x: number; y: number } | null>(null)

  if (loading) return <Spinner fullscreen />
  if (user) return <Navigate to={estado.from ?? '/mi-dia'} replace />

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (errorLogin) {
      // Supabase devuelve el mismo error para usuario inexistente y contraseña
      // incorrecta, a propósito: no confirmamos qué emails existen.
      setError('Email o contraseña incorrectos')
      setEnviando(false)
      return
    }

    navigate(estado.from ?? '/mi-dia', { replace: true })
  }

  function seguirConElAura(e: React.MouseEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    setAura({
      x: e.clientX - caja.left - RADIO_AURA,
      y: e.clientY - caja.top - RADIO_AURA,
    })
  }

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* ---------- Panel de marca ---------- */}
      <aside className="relative h-[260px] shrink-0 overflow-hidden lg:h-auto lg:w-[45%]">
        <img
          src={fotoHero}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        {/* La foto viene recortada 3:4, casi la proporción del panel: el cover
            apenas recorta y el encuadre queda centrado. */}
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: SCRIM }} />

        <div className="relative flex h-full flex-col justify-between p-6 text-white lg:p-10 lg:pb-12">
          <Marca />
          <p className="m-0 max-w-[320px] text-[1.3rem] leading-tight font-semibold tracking-tight lg:text-[1.625rem]">
            Cerrá más, perdé menos.
          </p>
        </div>
      </aside>

      {/* ---------- Panel del formulario ---------- */}
      <div
        onMouseMove={seguirConElAura}
        onMouseLeave={() => setAura(null)}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-6 py-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 size-[500px] rounded-full opacity-0 blur-[50px] transition-opacity duration-300 motion-reduce:transition-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 34%, transparent) 0%, transparent 72%)',
            transform: `translate(${aura?.x ?? 0}px, ${aura?.y ?? 0}px)`,
            opacity: aura ? 1 : 0,
          }}
        />

        <div className="relative w-full max-w-[380px]">
          <h1 className="m-0 text-[1.75rem] font-bold tracking-tight text-ink">
            Entrar a LeadEra
          </h1>
          <p className="mt-2 mb-8 text-sm text-ink-muted">
            Ingresá con tu cuenta para ver tus leads y operaciones.
          </p>

          <form onSubmit={manejarSubmit} className="space-y-5" noValidate>
            {estado.aviso && (
              <p className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">
                {estado.aviso}
              </p>
            )}

            {error && <MensajeError>{error}</MensajeError>}

            <CampoConGlow
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="ejemplo@leadera.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <CampoConGlow
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="pt-1">
              <BotonPrimario cargando={enviando}>
                {enviando ? 'Entrando…' : 'Entrar'}
              </BotonPrimario>
            </div>
          </form>

          <p className="mt-7 text-center text-sm text-ink-muted">
            ¿Todavía no tenés cuenta?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Creá tu inmobiliaria
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

/**
 * Campo del login con el glow que sigue al cursor por el borde.
 *
 * Es propio de esta pantalla y no `Campo`, porque el glow tiene que envolver
 * sólo el input —no la label— y `Campo` lo comparte el alta, que no lleva
 * este efecto.
 *
 * El `--mx` vive en estado local del campo: así mover el mouse sobre un input
 * no vuelve a renderizar el otro ni el resto del formulario.
 */
function CampoConGlow({
  label,
  ...props
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  const id = useId()
  const [mx, setMx] = useState('50%')

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>

      <div
        onMouseMove={(e) => setMx(`${e.clientX - e.currentTarget.getBoundingClientRect().left}px`)}
        // Los degradés se declaran acá como custom properties y las pseudo, que
        // heredan, los consumen. Escritos como clase arbitraria habría que
        // escapar cada espacio y coma; así quedan legibles y `--mx` se resuelve
        // en el pintado, sin recalcular la clase en cada movimiento.
        style={
          {
            '--mx': mx,
            '--glow-arriba':
              'radial-gradient(30px circle at var(--mx) 0px, var(--color-primary) 0%, transparent 70%)',
            '--glow-abajo':
              'radial-gradient(30px circle at var(--mx) 2px, var(--color-primary) 0%, transparent 70%)',
          } as CSSProperties
        }
        className={[
          'relative mt-1.5 rounded-md',
          // Dos líneas de 2px, arriba y abajo, con un degradé radial centrado
          // en el cursor. Aparecen al pasar por encima o al enfocar.
          "before:pointer-events-none before:absolute before:inset-x-0 before:-top-px before:z-10 before:h-0.5 before:rounded-t-md before:opacity-0 before:transition-opacity before:content-[''] before:[background-image:var(--glow-arriba)]",
          "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:z-10 after:h-0.5 after:rounded-b-md after:opacity-0 after:transition-opacity after:content-[''] after:[background-image:var(--glow-abajo)]",
          'hover:before:opacity-100 hover:after:opacity-100',
          'focus-within:before:opacity-100 focus-within:after:opacity-100',
          'motion-reduce:before:transition-none motion-reduce:after:transition-none',
        ].join(' ')}
      >
        <input
          id={id}
          className={[
            'block w-full rounded-md border border-border bg-surface px-3 py-2.5',
            'text-sm text-ink placeholder:text-ink-subtle',
            'transition-colors motion-reduce:transition-none',
            'focus:border-primary focus:outline-none',
          ].join(' ')}
          {...props}
        />
      </div>
    </div>
  )
}
