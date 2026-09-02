import type { ReactNode } from 'react'
import { CLASES_CONTROL } from './estilosFormulario'

/**
 * Inputs de los formularios de alta (mismo look que NuevoLead): fondo
 * `surface-2`, radio 12px y alto táctil.
 *
 * NuevoLead todavía tiene su propia copia local de estos helpers; unificarlo
 * es un cambio de una línea allá, pero toca el módulo de Leads y quedó fuera
 * del alcance de esta fase.
 */

interface CampoProps {
  label: string
  /** Ocupa las dos columnas de la grilla. */
  full?: boolean
  children: ReactNode
  ayuda?: string
}

export function Campo({ label, full = false, children, ayuda }: CampoProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'min-[651px]:col-span-2' : ''}`}>
      <label className="text-[0.85rem] font-semibold text-ink-2">{label}</label>
      {children}
      {ayuda && <p className="text-xs text-ink-3">{ayuda}</p>}
    </div>
  )
}

/** Mensaje de validación bajo un campo. Lo anuncian los lectores de pantalla. */
export function ErrorCampo({ children }: { children: ReactNode }) {
  return (
    <span role="alert" className="text-xs text-peligro-ink">
      {children}
    </span>
  )
}

interface InputProps {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  invalido?: boolean
  min?: number
  step?: string
}

export function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  invalido,
  min,
  step,
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className={`${CLASES_CONTROL} ${invalido ? 'border-peligro-ink' : ''}`}
    />
  )
}
