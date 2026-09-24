import { useState, type InputHTMLAttributes, type Ref } from 'react'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement>
}

/**
 * Input de contraseña con botón para mostrarla u ocultarla.
 *
 * Los estilos del input los pone cada pantalla por `className`; acá sólo se
 * suma el `pr-10` para que el texto no quede debajo del botón. El resto de las
 * props (`name`, `id`, `autoComplete`…) pasan tal cual, así el gestor de
 * contraseñas del navegador lo sigue reconociendo.
 */
export function PasswordInput({ className = '', ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        // Después del spread: si alguien pasa `type`, no pisa el toggle.
        type={visible ? 'text' : 'password'}
        className={[
          className,
          'pr-10',
          // Edge dibuja su propio ojito: lo ocultamos para no tener dos.
          '[&::-ms-clear]:hidden [&::-ms-reveal]:hidden',
        ].join(' ')}
      />

      {/* Más chico que el input y centrado, para no tocar el borde ni las
          líneas de glow que el login dibuja arriba y abajo. */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Sin esto el click le saca el foco al input.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        disabled={props.disabled}
        className={[
          'absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded',
          'text-ink-subtle transition-colors hover:text-ink motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary',
          'disabled:cursor-not-allowed disabled:hover:text-ink-subtle',
        ].join(' ')}
      >
        {visible ? <IconoOjoTachado /> : <IconoOjo />}
      </button>
    </div>
  )
}

// Trazos de Eye / EyeOff de Lucide, inline para no sumar la dependencia.
const propsIcono = {
  'aria-hidden': true,
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function IconoOjo() {
  return (
    <svg {...propsIcono}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconoOjoTachado() {
  return (
    <svg {...propsIcono}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  )
}
