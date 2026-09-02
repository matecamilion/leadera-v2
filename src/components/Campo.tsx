import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
}

/** Input con label asociada. La label siempre es visible: no usamos placeholders como etiqueta. */
export function Campo({ label, className = '', ...props }: CampoProps) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        className={[
          'mt-1.5 block w-full rounded-md border border-border bg-surface px-3 py-2',
          'text-sm text-ink placeholder:text-ink-subtle',
          'transition-colors motion-reduce:transition-none',
          'hover:border-ink-subtle',
          'focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
          className,
        ].join(' ')}
        {...props}
      />
    </div>
  )
}

/** Botón principal de los formularios. Ocupa el ancho y refleja el estado de envío. */
export function BotonPrimario({
  cargando,
  children,
  ...props
}: { cargando?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      {...props}
    >
      {cargando && (
        <span className="size-4 animate-spin rounded-full border-2 border-primary-contrast/40 border-t-primary-contrast motion-reduce:animate-none" />
      )}
      {children}
    </button>
  )
}

/** Mensaje de error del formulario. Anunciado por lectores de pantalla. */
export function MensajeError({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger"
    >
      {children}
    </p>
  )
}
