import { useEffect, useRef, useState, type FormEvent } from 'react'
import { InputTelefono } from '../comunes/InputTelefono'
import type { ContactoLead, Lead } from '../../lib/api/leads'

interface ModalEditarContactoProps {
  abierto: boolean
  lead: Lead
  guardando: boolean
  /** Error del servidor. Los de validación se resuelven acá adentro. */
  error?: string | null
  onCerrar: () => void
  onGuardar: (contacto: ContactoLead) => void
}

export function ModalEditarContacto({
  abierto,
  lead,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: ModalEditarContactoProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [nombre, setNombre] = useState(lead.nombre)
  const [apellido, setApellido] = useState(lead.apellido ?? '')
  const [telefono, setTelefono] = useState(lead.telefono ?? '')
  const [email, setEmail] = useState(lead.email ?? '')
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) {
      // Al abrir, partimos siempre de los datos actuales del lead.
      setNombre(lead.nombre)
      setApellido(lead.apellido ?? '')
      setTelefono(lead.telefono ?? '')
      setEmail(lead.email ?? '')
      setErrorLocal(null)
      dialog.showModal()
    }
    if (!abierto && dialog.open) dialog.close()
  }, [abierto, lead])

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()

    // Mismas validaciones que guardarContacto() del Angular.
    if (!nombre.trim()) return setErrorLocal('El nombre es obligatorio.')
    if (!apellido.trim()) return setErrorLocal('El apellido es obligatorio.')
    if (!telefono.trim()) return setErrorLocal('El teléfono es obligatorio.')
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setErrorLocal('El email no tiene un formato válido.')
    }

    setErrorLocal(null)
    onGuardar({ nombre, apellido, telefono, email: email.trim() || null })
  }

  return (
    <dialog
      ref={ref}
      aria-label="Editar contacto del lead"
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      className="m-auto w-[400px] max-w-[90vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form onSubmit={manejarSubmit} className="box-border p-[30px] text-left" noValidate>
        <h3 className="mb-5 text-center text-lg font-bold text-ink">Editar contacto</h3>

        <CampoEdicion label="Nombre" value={nombre} onChange={setNombre} placeholder="Nombre" />
        <CampoEdicion
          label="Apellido"
          value={apellido}
          onChange={setApellido}
          placeholder="Apellido"
        />
        {/* Ayuda visual solamente: las validaciones del submit no cambian. */}
        <CampoEdicion
          label="Teléfono"
          value={telefono}
          onChange={setTelefono}
          placeholder="Ej: 223 123-4567"
          telefono
        />
        <CampoEdicion
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="nombre@dominio.com"
        />

        {(errorLocal || error) && (
          <p role="alert" className="m-0 text-[0.85rem] text-peligro-ink">
            {errorLocal ?? error}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-caliente bg-transparent px-4 py-2.5 font-semibold text-caliente transition-colors hover:bg-hot-soft disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 rounded-lg border-none bg-primary px-4 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

const CLASES_CAMPO =
  'w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors outline-none focus:border-primary motion-reduce:transition-none'

function CampoEdicion({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  telefono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  /** Agrupa los dígitos mientras se tipea. No valida nada. */
  telefono?: boolean
}) {
  return (
    <label className="mb-4 flex flex-col gap-1.5 text-left">
      <span className="text-[0.85rem] font-semibold text-ink-2">{label}</span>
      {telefono ? (
        <InputTelefono
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={CLASES_CAMPO}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={CLASES_CAMPO}
        />
      )}
    </label>
  )
}
