import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { InputTelefono } from '../components/comunes/InputTelefono'
import { IconoPersonaMas } from '../components/leads/Iconos'
import { useCrearLead } from '../hooks/useLead'
import { ORIGENES_LEAD, type OrigenLead } from '../lib/api/leads'
import { esMomentoPasado, hoyComoMinimoLocal } from '../lib/calendario'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import { useUiStore } from '../stores/ui'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NuevoLead() {
  const navigate = useNavigate()
  const crear = useCrearLead()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [origen, setOrigen] = useState<OrigenLead>('MANUAL')
  const [seguimiento, setSeguimiento] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  // Separado del de email: un fallo del guardado no es culpa de ese campo.
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  // Contra el reloj y no contra el día: el agente elige la hora a mano, así que
  // dejar pasar "hoy a las 9" cuando son las 15 sería agendar para atrás. Misma
  // regla que el próximo contacto del modal de interacción, que escribe esta
  // misma columna del lead.
  const seguimientoPasado = !!seguimiento && esMomentoPasado(seguimiento)
  const completo =
    nombre.trim() && apellido.trim() && telefono.trim() && !seguimientoPasado

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorEmail(null)
    setErrorGeneral(null)

    if (!completo) return
    if (email.trim() && !EMAIL_VALIDO.test(email.trim())) {
      setErrorEmail('El email no tiene un formato válido.')
      return
    }

    try {
      // `estado` no se manda: todo lead nace en NULL ("nuevo").
      const lead = await crear.mutateAsync({
        nombre,
        apellido,
        telefono,
        email: email.trim() || undefined,
        origen,
        descripcion_inicial: descripcion.trim() || undefined,
        fecha_proximo_seguimiento: seguimiento || undefined,
      })
      // Antes de navegar y por el store: el alta se desmonta al saltar a la
      // ficha y no podría mostrar el aviso ella misma.
      mostrarAviso('Lead creado.')
      navigate(`/leads/${lead.id}`, { replace: true })
    } catch (err) {
      setErrorGeneral(mensajeDeGuardado(err, 'No se pudo crear el lead.'))
    }
  }

  return (
    <div className="mx-auto my-5 box-border w-full max-w-[800px] rounded-lg bg-surface p-6 shadow-md">
      <header className="mb-6 flex items-center gap-4">
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-brand-softer p-3 text-primary">
          <IconoPersonaMas className="size-6" />
        </span>
        <div>
          <h1 className="m-0 text-[clamp(1.1rem,4vw,1.5rem)] font-bold text-ink">
            Nuevo Prospecto
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-3">
            Define los datos básicos del contacto en el sistema
          </p>
        </div>
      </header>

      {errorGeneral && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {errorGeneral}
        </p>
      )}

      <form onSubmit={manejarSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 min-[651px]:grid-cols-2 min-[651px]:gap-5">
          <Campo label="Nombre *">
            <Input value={nombre} onChange={setNombre} placeholder="Ej: Mateo" required />
          </Campo>

          <Campo label="Apellido *">
            <Input
              value={apellido}
              onChange={setApellido}
              placeholder="Ej: Rodriguez"
              required
            />
          </Campo>

          <Campo label="Teléfono / WhatsApp *">
            {/* El agrupado es cosmético: el submit sigue mirando sólo que no
                esté vacío, igual que antes. */}
            <InputTelefono
              value={telefono}
              onChange={setTelefono}
              placeholder="223 123-4567"
              required
              className={CLASES_TELEFONO}
            />
          </Campo>

          <Campo label="Email">
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="mateo@ejemplo.com"
              invalido={Boolean(errorEmail)}
            />
            {errorEmail && (
              <span role="alert" className="mt-1 block text-xs text-peligro-ink">
                {errorEmail}
              </span>
            )}
          </Campo>

          {/* Sin selector de Estado Inicial: el lead nace en NULL ("nuevo"),
              y eso es lo que ordena el listado por prioridad. */}

          <Campo label="Origen del lead *">
            <select
              value={origen}
              onChange={(e) => setOrigen(e.target.value as OrigenLead)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base text-ink transition-colors focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none motion-reduce:transition-none"
            >
              {ORIGENES_LEAD.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>

          {/* En el original este campo era full-width porque compartía fila con
              "Estado Inicial". Sin ese campo, va a media columna al lado de
              Origen para no dejar un hueco en la grilla. */}
          <Campo label="Programar primer seguimiento (Opcional)">
            <Input
              type="datetime-local"
              value={seguimiento}
              onChange={setSeguimiento}
              min={hoyComoMinimoLocal()}
              invalido={seguimientoPasado}
            />
            {seguimientoPasado && (
              <span role="alert" className="mt-1 block text-xs text-peligro-ink">
                El seguimiento no puede ser una fecha pasada.
              </span>
            )}
          </Campo>

          <Campo label="¿Qué sabés del lead? (Opcional)" full>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ej: Vino referido por Juan. Busca depto de 2 ambientes en zona céntrica, presupuesto USD 80k."
              className="min-h-20 w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base leading-normal text-ink transition-colors focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none motion-reduce:transition-none"
            />
          </Campo>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 min-[481px]:flex-row min-[481px]:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-border bg-surface px-6 py-3 font-semibold text-ink-3 transition-colors hover:bg-background min-[481px]:py-3 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!completo || crear.isPending}
            className="rounded-md border-none bg-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {crear.isPending ? 'Creando…' : 'Crear y Continuar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Campo({
  label,
  full = false,
  children,
}: {
  label: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'min-[651px]:col-span-2' : ''}`}>
      <label className="text-[0.85rem] font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  )
}

/**
 * Las mismas clases que arma `Input` para un campo válido. Están sueltas acá
 * porque `InputTelefono` trae su propio <input> —necesita el evento para saber
 * dónde está el cursor— y tiene que verse igual que el resto del formulario.
 */
const CLASES_TELEFONO = [
  'w-full rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base text-ink',
  'transition-colors focus:border-primary focus:bg-surface focus:shadow-focus',
  'focus:outline-none motion-reduce:transition-none',
].join(' ')

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  invalido,
  min,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  invalido?: boolean
  /** Mínimo del control; sólo aplica a los de fecha. */
  min?: string
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'w-full rounded-xl border bg-surface-2 px-4 py-3.5 text-base text-ink',
        'transition-colors focus:bg-surface focus:shadow-focus focus:outline-none',
        'motion-reduce:transition-none',
        invalido ? 'border-peligro-ink' : 'border-border focus:border-primary',
      ].join(' ')}
    />
  )
}
