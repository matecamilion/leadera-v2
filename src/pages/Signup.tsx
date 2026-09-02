import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'
import { BotonPrimario, Campo, MensajeError } from '../components/Campo'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, signup, type SignupInput } from '../lib/api/auth'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // El token de invitación llega por la URL: /signup?invite=<token>
  const invite = searchParams.get('invite')?.trim() || null
  const esInvitado = invite !== null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [nombreInmobiliaria, setNombreInmobiliaria] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (loading) return <Spinner fullscreen />
  if (user) return <Navigate to="/mi-dia" replace />

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    // El rol, la inmobiliaria y el asiste_a de un invitado los define el token
    // del lado del servidor. Acá sólo mandamos el token y los datos personales.
    const input: SignupInput = esInvitado
      ? { tipo: 'invitado', token: invite, email, password, nombre, apellido }
      : {
          tipo: 'independiente',
          email,
          password,
          nombre,
          apellido,
          nombre_inmobiliaria: nombreInmobiliaria,
        }

    try {
      const resultado = await signup(input)

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

      // Cuenta creada pero sin sesión utilizable: que entre por el login.
      navigate('/login', {
        replace: true,
        state: { aviso: 'Cuenta creada, iniciá sesión' },
      })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo crear la cuenta',
      )
      setEnviando(false)
    }
  }

  return (
    <AuthShell
      titulo={esInvitado ? 'Sumate a tu equipo' : 'Creá tu inmobiliaria'}
      descripcion={
        esInvitado
          ? 'Te invitaron a LeadEra. Completá tus datos para activar tu cuenta.'
          : 'Empezá a gestionar tus leads, propiedades y operaciones.'
      }
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

        {!esInvitado && (
          <Campo
            label="Nombre de la inmobiliaria"
            name="nombre_inmobiliaria"
            autoComplete="organization"
            required
            value={nombreInmobiliaria}
            onChange={(e) => setNombreInmobiliaria(e.target.value)}
          />
        )}

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
