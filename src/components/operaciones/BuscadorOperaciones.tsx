import { useEffect, useState } from 'react'
import { IconoLupa } from '../leads/Iconos'

interface BuscadorOperacionesProps {
  /** Valor confirmado en el padre (ya con debounce aplicado). */
  valor: string
  onCambiar: (valor: string) => void
  debounceMs?: number
}

/**
 * Input de búsqueda con debounce.
 *
 * El texto tipeado vive acá para que el input responda a cada tecla; al padre
 * —y por lo tanto a la query— sólo le llega el valor cuando deja de tipear.
 *
 * Es el mismo componente que `BuscadorLeads`, copiado en vez de generalizado:
 * aquel sólo difiere en el `aria-label` y el placeholder, pero sacarlo a
 * `comunes/` obliga a tocar el módulo de Leads y eso quedó fuera de esta fase.
 * Cuando toque unificar, este archivo y el de allá se borran juntos.
 */
export function BuscadorOperaciones({
  valor,
  onCambiar,
  debounceMs = 300,
}: BuscadorOperacionesProps) {
  const [texto, setTexto] = useState(valor)

  useEffect(() => {
    if (texto === valor) return
    const id = setTimeout(() => onCambiar(texto), debounceMs)
    return () => clearTimeout(id)
  }, [texto, valor, onCambiar, debounceMs])

  return (
    <div className="relative w-full md:max-w-[400px]">
      <IconoLupa className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Buscar operaciones"
        placeholder="Buscar por título, lead o propiedad..."
        className="w-full rounded-md border border-border bg-surface py-3 pr-3 pl-[42px] text-[0.9rem] text-ink placeholder:text-ink-3 focus:border-primary focus:shadow-focus focus:outline-none"
      />
    </div>
  )
}
