import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  actualizarDatosCuenta,
  cambiarPassword,
  LARGO_MINIMO_PASSWORD,
} from '../lib/api/perfil'

function iniciales(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase() || 'A'
}

const ETIQUETA_ROL: Record<string, string> = {
  DUENO: 'Dueño',
  AGENTE: 'Agente',
  ASISTENTE: 'Asistente',
}

export default function Perfil() {
  const { user, profile, refrescarPerfil } = useAuth()

  const nombre = profile?.nombre ?? ''
  const apellido = profile?.apellido ?? ''
  const rol = profile ? (ETIQUETA_ROL[profile.rol] ?? profile.rol) : ''

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

      <div className="space-y-4">
        {/* El borrador del form arranca del profile; el key lo remonta cuando
            el profile cambia de verdad, así un refetch no pisa lo tipeado. */}
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
      </div>
    </div>
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
