import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { AuthShell } from '../components/AuthShell'
import { BotonPrimario, MensajeError } from '../components/Campo'
import { Spinner } from '../components/Spinner'
import { PasswordInput } from '../components/ui/PasswordInput'
import {
  leerRecuperacion,
  limpiarRecuperacion,
  suscribirRecuperacion,
} from '../lib/recuperacion'
import { supabase } from '../lib/supabase'
import { PASSWORD_MINIMO } from '../lib/validaciones'

/** Cuánto se espera PASSWORD_RECOVERY una vez que el cliente terminó de iniciar. */
const ESPERA_EVENTO_MS = 3000

type Estado = 'verificando' | 'listo' | 'invalido'

export default function ResetPassword() {
  const navigate = useNavigate()
  const recuperacion = useSyncExternalStore(suscribirRecuperacion, leerRecuperacion)

  // Se vence la espera del evento. El estado visible se deriva de esto y del
  // store: el evento puede llegar antes o después de montar, y cualquiera de
  // los dos caminos termina en el mismo render.
  const [agotado, setAgotado] = useState(false)

  // Una vez que se muestra el formulario no se vuelve atrás: al guardar se
  // limpia el store, y el form no tiene que pasar a "inválido" en el medio.
  const [confirmado, setConfirmado] = useState(false)

  const estado: Estado =
    confirmado || recuperacion.sesionRecuperacion
      ? 'listo'
      : recuperacion.error || agotado
        ? 'invalido'
        : 'verificando'

  if (estado === 'listo' && !confirmado) setConfirmado(true)

  useEffect(() => {
    let activo = true
    let timer: ReturnType<typeof setTimeout> | undefined

    // getSession espera a que el cliente termine de procesar la URL. Recién
    // ahí corre el reloj: con red lenta, validar el token puede tardar más de
    // lo que dura la espera.
    void supabase.auth.getSession().then(() => {
      if (!activo) return
      // Sin `type=recovery` en el hash no hay evento que esperar: quien entra
      // directo a la ruta, con o sin sesión, va a "inválido" sin demora.
      const espera = leerRecuperacion().esRecuperacion ? ESPERA_EVENTO_MS : 0
      timer = setTimeout(() => setAgotado(true), espera)
    })

    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [])

  if (estado === 'verificando') return <Spinner fullscreen label="Verificando el link" />

  if (estado === 'invalido') {
    return (
      <AuthShell
        titulo="El link venció o ya fue usado"
        descripcion="Los links para crear una nueva contraseña sirven una sola vez y por tiempo limitado. Pedí uno nuevo."
        pie={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Volver a entrar
          </Link>
        }
      >
        <Link
          to="/recuperar-contrasena"
          className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
        >
          Pedir un link nuevo
        </Link>
      </AuthShell>
    )
  }

  return <FormularioNuevaContrasena onListo={() => navigate('/login', AVISO_EXITO)} />
}

const AVISO_EXITO = {
  replace: true,
  state: { aviso: 'Contraseña actualizada. Ingresá con la nueva.' },
}

function FormularioNuevaContrasena({ onListo }: { onListo: () => void }) {
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < PASSWORD_MINIMO) {
      setError(`La contraseña tiene que tener al menos ${PASSWORD_MINIMO} caracteres`)
      return
    }
    if (password !== repetida) {
      setError('Las contraseñas no coinciden')
      return
    }

    setEnviando(true)
    const { error: errorUpdate } = await supabase.auth.updateUser({ password })

    if (errorUpdate) {
      setError(mensajeErrorUpdate(errorUpdate))
      setEnviando(false)
      return
    }

    limpiarRecuperacion()

    // Cierra todas las sesiones, ésta incluida. Hay que esperar a que termine
    // antes de navegar: con la sesión todavía viva, Login rebota a /mi-dia.
    const { error: errorSalida } = await supabase.auth.signOut({ scope: 'global' })
    if (errorSalida) {
      // La contraseña ya cambió; si falló el cierre remoto, por lo menos que
      // no quede la sesión en este navegador.
      await supabase.auth.signOut({ scope: 'local' })
    }

    onListo()
  }

  return (
    <AuthShell
      titulo="Nueva contraseña"
      descripcion="Elegí la contraseña con la que vas a entrar de ahora en más."
    >
      <form onSubmit={manejarSubmit} className="space-y-4" noValidate>
        {error && <MensajeError>{error}</MensajeError>}

        <div>
          <CampoContrasena
            label="Nueva contraseña"
            name="new-password"
            value={password}
            onChange={setPassword}
            disabled={enviando}
          />
          <p className="mt-1.5 text-xs text-ink-subtle">Mínimo {PASSWORD_MINIMO} caracteres.</p>
        </div>

        <CampoContrasena
          label="Repetí la contraseña"
          name="confirm-password"
          value={repetida}
          onChange={setRepetida}
          disabled={enviando}
        />

        <BotonPrimario cargando={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </BotonPrimario>
      </form>
    </AuthShell>
  )
}

function mensajeErrorUpdate(error: { code?: string; status?: number }): string {
  if (isAuthRetryableFetchError(error)) {
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  }
  switch (error.code) {
    case 'same_password':
      return 'La nueva contraseña tiene que ser distinta a la actual'
    case 'weak_password':
      return 'La contraseña es muy débil. Probá con una más larga o que combine letras, números y símbolos.'
    case 'session_not_found':
    case 'session_expired':
    case 'reauthentication_needed':
      return 'El link venció. Pedí uno nuevo para cambiar la contraseña.'
    default:
      return 'No se pudo actualizar la contraseña. Probá de nuevo en un momento.'
  }
}

/** Mismo aspecto que `Campo`, con el botón de mostrar/ocultar. */
function CampoContrasena({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string
  name: string
  value: string
  onChange: (valor: string) => void
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">
        <PasswordInput
          id={id}
          name={name}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MINIMO}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={[
            'block w-full rounded-md border border-border bg-surface px-3 py-2',
            'text-sm text-ink placeholder:text-ink-subtle',
            'transition-colors motion-reduce:transition-none',
            'hover:border-ink-subtle',
            'focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
          ].join(' ')}
        />
      </div>
    </div>
  )
}
