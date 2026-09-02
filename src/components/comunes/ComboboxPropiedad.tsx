import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  buscarPropiedadesParaCombobox,
  type PropiedadResumida,
} from '../../lib/api/operaciones'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import { IconoLupa } from '../leads/Iconos'
import { CLASES_CONTROL } from './estilosFormulario'

interface ComboboxPropiedadProps {
  value: string | null
  onChange: (propiedadId: string | null) => void
  placeholder?: string
  debounceMs?: number
}

async function obtenerPropiedadResumida(id: string): Promise<PropiedadResumida | null> {
  const { data, error } = await supabase
    .from('propiedades')
    .select('id, direccion, tipo, precio')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar la propiedad: ${error.message}`)
  return data
}

/**
 * Selector de propiedad por dirección.
 *
 * Mismo patrón visual que ComboboxLead pero **sólo búsqueda**: no ofrece alta
 * inline. Cargar una propiedad completa desde un dropdown chico no tiene
 * sentido, y siempre se puede vincular después.
 */
export function ComboboxPropiedad({
  value,
  onChange,
  placeholder = 'Buscar por dirección...',
  debounceMs = 300,
}: ComboboxPropiedadProps) {
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const { data: seleccionada } = useQuery({
    queryKey: ['propiedad-resumida', value],
    queryFn: () => obtenerPropiedadResumida(value as string),
    enabled: Boolean(value),
  })

  useEffect(() => {
    if (texto === busqueda) return
    const id = setTimeout(() => setBusqueda(texto), debounceMs)
    return () => clearTimeout(id)
  }, [texto, busqueda, debounceMs])

  const { data: resultados, isFetching } = useQuery({
    queryKey: ['propiedades-combobox', busqueda],
    queryFn: () => buscarPropiedadesParaCombobox(busqueda),
    enabled: busqueda.trim().length > 0,
  })

  useEffect(() => {
    if (!abierto) return
    function alClickear(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [abierto])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <span className="min-w-0 truncate text-base text-ink">
          {seleccionada ? seleccionada.direccion : 'Cargando…'}
          {seleccionada && (
            <span className="text-ink-3">
              {' · '}
              {etiquetaTipo(seleccionada.tipo)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setAbierto(true)
          }}
          className="shrink-0 rounded-md px-2 py-1 text-[0.8rem] font-semibold text-primary transition-colors hover:bg-brand-softer motion-reduce:transition-none"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div ref={contenedor} className="relative">
      <div className="relative">
        <IconoLupa className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-autocomplete="list"
          value={texto}
          placeholder={placeholder}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          className={`${CLASES_CONTROL} pl-11`}
        />
      </div>

      {abierto && texto.trim() && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-md">
          <ul className="max-h-72 overflow-y-auto py-1">
            {isFetching && <li className="px-4 py-3 text-sm text-ink-3">Buscando…</li>}

            {!isFetching &&
              resultados?.map((propiedad) => (
                <li key={propiedad.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(propiedad.id)
                      setTexto('')
                      setBusqueda('')
                      setAbierto(false)
                    }}
                    className="flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-background motion-reduce:transition-none"
                  >
                    <span className="text-sm font-medium text-ink">
                      {propiedad.direccion}
                    </span>
                    <span className="text-xs text-ink-3">
                      {etiquetaTipo(propiedad.tipo)}
                      {propiedad.precio != null
                        ? ` · ${formatearPrecio(propiedad.precio, 'USD')}`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}

            {!isFetching && resultados?.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-ink-3">
                No encontramos propiedades con esa dirección.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
