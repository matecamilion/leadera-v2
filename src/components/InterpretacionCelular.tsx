import { formatearInternacional, normalizarCelularRegistro } from '../lib/telefono'

/**
 * La línea de debajo del campo de celular: cómo se interpretó lo tipeado, o por
 * qué no sirve. Con el campo vacío no dice nada; el error de un número a medio
 * escribir sólo aparece cuando `mostrarError` es true (al salir del campo o al
 * enviar), para no regañar mientras se tipea.
 */
export function InterpretacionCelular({
  valor,
  mostrarError,
  prefijo = 'Te escribiremos a',
}: {
  valor: string
  mostrarError: boolean
  prefijo?: string
}) {
  if (!valor.trim()) return null

  const resultado = normalizarCelularRegistro(valor)
  if (resultado.ok) {
    return (
      <p className="mt-1.5 text-xs text-ink-subtle">
        {prefijo} {formatearInternacional(resultado.e164)}
      </p>
    )
  }
  if (!mostrarError) return null
  return (
    <p role="alert" className="mt-1.5 text-xs text-peligro-ink">
      {resultado.motivo}
    </p>
  )
}
