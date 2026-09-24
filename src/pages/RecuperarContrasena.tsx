import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { AuthShell } from '../components/AuthShell'
import { BotonPrimario, Campo, MensajeError } from '../components/Campo'
import { supabase } from '../lib/supabase'

/** Lo que tarda en habilitarse de nuevo el botón: lo mismo que el rate limit de Supabase. */
const ESPERA_SEGUNDOS = 60

/**
 * El mismo texto para "mail enviado" y para "ese mail no existe": no
 * confirmamos qué emails tienen cuenta.
 */
const MENSAJE_NEUTRO =
  'Si el mail está registrado, te enviamos un link para crear una nueva contraseña. Revisá también spam.'

export default function RecuperarContrasena() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restante, setRestante] = useState(0)

  const esperando = restante > 0
  useEffect(() => {
    if (!esperando) return
    const timer = setInterval(() => setRestante((s) => Math.max(s - 1, 0)), 1000)
    return () => clearInterval(timer)
  }, [esperando])

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const limpio = email.trim().toLowerCase()
    if (!limpio || !limpio.includes('@')) {
      setError('Ingresá tu email')
      return
    }

    setEnviando(true)
    const { error: errorEnvio } = await supabase.auth.resetPasswordForEmail(limpio, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setEnviando(false)

    if (errorEnvio && isAuthRetryableFetchError(errorEnvio)) {
      // No llegó al servidor: el usuario puede reintentar ya.
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      return
    }

    // Llegó al servidor: haya salido bien o no, el botón espera.
    setRestante(ESPERA_SEGUNDOS)

    if (errorEnvio && (errorEnvio.code === 'over_email_send_rate_limit' || errorEnvio.status === 429)) {
      setError('Esperá un minuto antes de pedir otro mail')
      return
    }

    // Cualquier otro error se muestra igual que el éxito.
    setEnviado(true)
  }

  return (
    <AuthShell
      titulo="Recuperar contraseña"
      descripcion="Ingresá el email de tu cuenta y te mandamos un link para crear una nueva."
      pie={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Volver a entrar
        </Link>
      }
    >
      <form onSubmit={manejarSubmit} className="space-y-4" noValidate>
        {enviado && !error && (
          <p
            role="status"
            className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm text-success"
          >
            {MENSAJE_NEUTRO}
          </p>
        )}

        {error && <MensajeError>{error}</MensajeError>}

        <Campo
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="ejemplo@leadera.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <BotonPrimario cargando={enviando} disabled={enviando || esperando}>
          {enviando
            ? 'Enviando…'
            : esperando
              ? `Podés pedir otro en ${restante} s`
              : enviado
                ? 'Enviar de nuevo'
                : 'Enviar link'}
        </BotonPrimario>
      </form>
    </AuthShell>
  )
}
