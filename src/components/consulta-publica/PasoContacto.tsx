import { useId, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { formatearMientrasTipea, telefonoInvalido } from '../../lib/telefono'
import { URL_PRIVACIDAD } from './catalogo'
import type { DatosContacto } from './tipos'

/**
 * Mismo criterio que la edge function: formato razonable y sin `%` ni `*`
 * (comodines de PostgREST). Si igual algo se escapa, el servidor contesta 400
 * con su mensaje.
 */
const RE_EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

const MENSAJE_TELEFONO =
  'Revisá el teléfono: tiene que tener entre 8 y 13 números, con código de área (por ejemplo 223 123-4567).'

/**
 * Input a 16 px: con menos, Safari de iOS hace zoom al enfocarlo. Por eso no se
 * usa `Campo` de la app, que va a 14 px.
 */
function CampoTexto({
  label,
  opcional,
  error,
  ...props
}: { label: string; opcional?: boolean; error?: string | null } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id'
>) {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {opcional && <span className="font-normal text-ink-subtle"> (opcional)</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        className={[
          'mt-1.5 block w-full rounded-md border bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-subtle',
          'focus:outline-2 focus:outline-offset-0',
          error
            ? 'border-danger focus:border-danger focus:outline-danger'
            : 'border-border hover:border-ink-subtle focus:border-primary focus:outline-primary',
        ].join(' ')}
        {...props}
      />
      {error && (
        <p id={idError} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface Props {
  nombreAsesor: string
  pideEmail: boolean
  contacto: DatosContacto
  onCambiar: (contacto: DatosContacto) => void
  onEnviar: (hp: string) => void
}

export function PasoContacto({ nombreAsesor, pideEmail, contacto, onCambiar, onEnviar }: Props) {
  // El consentimiento no se recuerda entre recargas: se confirma cada vez.
  const [consiente, setConsiente] = useState(false)
  const [hp, setHp] = useState('')
  const [errores, setErrores] = useState<{
    nombre?: string
    apellido?: string
    telefono?: string
    email?: string
    consentimiento?: string
  }>({})
  const idConsentimiento = useId()

  function set<K extends keyof DatosContacto>(campo: K, valor: DatosContacto[K]) {
    onCambiar({ ...contacto, [campo]: valor })
  }

  function validarTelefono(valor: string): string | undefined {
    return telefonoInvalido(valor) ? MENSAJE_TELEFONO : undefined
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const nuevos: typeof errores = {}
    if (!contacto.nombre.trim()) nuevos.nombre = 'Contanos tu nombre.'
    if (!contacto.apellido.trim()) nuevos.apellido = 'Contanos tu apellido.'
    nuevos.telefono = validarTelefono(contacto.telefono)
    if (pideEmail && contacto.email.trim() && !RE_EMAIL.test(contacto.email.trim())) {
      nuevos.email = 'Revisá el email: parece que le falta algo.'
    }
    if (!consiente) nuevos.consentimiento = 'Para enviar la consulta necesitamos tu conformidad.'

    const hayErrores = Object.values(nuevos).some(Boolean)
    setErrores(nuevos)
    if (!hayErrores) onEnviar(hp)
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <CampoTexto
        label="Nombre"
        name="nombre"
        autoComplete="given-name"
        maxLength={80}
        value={contacto.nombre}
        onChange={(e) => set('nombre', e.target.value)}
        error={errores.nombre}
      />
      <CampoTexto
        label="Apellido"
        name="apellido"
        autoComplete="family-name"
        maxLength={80}
        value={contacto.apellido}
        onChange={(e) => set('apellido', e.target.value)}
        error={errores.apellido}
      />
      <CampoTexto
        label="Teléfono / WhatsApp"
        name="telefono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={40}
        placeholder="223 123-4567"
        value={contacto.telefono}
        onChange={(e) => set('telefono', formatearMientrasTipea(e.target.value))}
        onBlur={() =>
          contacto.telefono.trim() &&
          setErrores((prev) => ({ ...prev, telefono: validarTelefono(contacto.telefono) }))
        }
        error={errores.telefono}
      />
      {pideEmail && (
        <CampoTexto
          label="Email"
          opcional
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          value={contacto.email}
          onChange={(e) => set('email', e.target.value)}
          error={errores.email}
        />
      )}

      {/* Honeypot: fuera de pantalla (no display:none, que algunos bots
          detectan), oculto a lectores de pantalla y fuera del orden de
          tabulación. Una persona nunca lo completa. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="sitio_web">Sitio web</label>
        <input
          id="sitio_web"
          name="sitio_web"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id={idConsentimiento}
            type="checkbox"
            checked={consiente}
            onChange={(e) => {
              setConsiente(e.target.checked)
              if (e.target.checked) setErrores((prev) => ({ ...prev, consentimiento: undefined }))
            }}
            aria-invalid={errores.consentimiento ? true : undefined}
            aria-describedby={errores.consentimiento ? `${idConsentimiento}-error` : undefined}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <label htmlFor={idConsentimiento} className="text-sm leading-snug text-ink-2">
            Tus datos los recibe {nombreAsesor} para responder tu consulta.{' '}
            <a
              href={URL_PRIVACIDAD}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              Política de privacidad
            </a>
          </label>
        </div>
        {errores.consentimiento && (
          <p id={`${idConsentimiento}-error`} className="mt-1.5 text-sm text-danger">
            {errores.consentimiento}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="mt-1 min-h-[52px] w-full rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
      >
        Enviar consulta
      </button>
    </form>
  )
}
