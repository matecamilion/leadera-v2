import { formatearMientrasTipea } from '../../lib/telefono'

interface InputTelefonoProps {
  value: string
  onChange: (v: string) => void
  /** Las clases del formulario donde vive: acá no hay estilo propio. */
  className: string
  placeholder?: string
  required?: boolean
}

/**
 * Input de teléfono con agrupado automático.
 *
 * Es ayuda visual y no validación: nunca rechaza ni recorta lo tipeado, y el
 * submit sigue mirando lo mismo de antes.
 *
 * El formateo se aplica sólo cuando el cursor está al final. Si el usuario está
 * corrigiendo un dígito en el medio —el caso del modal de edición, que arranca
 * con el número ya cargado— reformatear correría el cursor al final en cada
 * tecla. Por eso hace falta el <input> a mano y no alcanza con envolver el
 * `onChange` de los `Input` compartidos, que sólo pasan el string.
 */
export function InputTelefono({
  value,
  onChange,
  className,
  placeholder,
  required,
}: InputTelefonoProps) {
  return (
    <input
      // `tel` le pide al teclado del celular el pad numérico con + y *.
      type="tel"
      inputMode="tel"
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={(e) => {
        const campo = e.target
        const alFinal =
          campo.selectionStart === null || campo.selectionStart === campo.value.length
        onChange(alFinal ? formatearMientrasTipea(campo.value) : campo.value)
      }}
      className={className}
    />
  )
}
