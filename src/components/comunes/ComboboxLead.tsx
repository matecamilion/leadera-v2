import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  buscarLeadsParaCombobox,
  crearLead,
  obtenerLeadResumido,
  type LeadResumido,
} from '../../lib/api/leads'
import { IconoCerrar, IconoLupa } from '../leads/Iconos'
import { CLASES_CONTROL } from './estilosFormulario'

interface ComboboxLeadProps {
  value: string | null
  onChange: (leadId: string | null) => void
  /** Texto del input cuando no hay nada seleccionado. */
  placeholder?: string
  debounceMs?: number
}

/**
 * Selector de lead con búsqueda y alta rápida.
 *
 * Deliberadamente genérico —no sabe nada de propiedades— porque el mismo
 * patrón se repite en Operaciones y Búsquedas.
 *
 * El alta rápida vive dentro del propio dropdown y no en un modal aparte:
 * abrir un `<dialog>` encima de un formulario obliga al usuario a perder de
 * vista lo que venía cargando.
 */
export function ComboboxLead({
  value,
  onChange,
  placeholder = 'Buscar por nombre o teléfono...',
  debounceMs = 300,
}: ComboboxLeadProps) {
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  // Lead seleccionado: lo traemos por id para poder mostrar su nombre aunque
  // el value venga de afuera (por ejemplo, de un formulario ya guardado).
  const { data: seleccionado } = useQuery({
    queryKey: ['lead-resumido', value],
    queryFn: () => obtenerLeadResumido(value as string),
    enabled: Boolean(value),
  })

  useEffect(() => {
    if (texto === busqueda) return
    const id = setTimeout(() => setBusqueda(texto), debounceMs)
    return () => clearTimeout(id)
  }, [texto, busqueda, debounceMs])

  const { data: resultados, isFetching } = useQuery({
    queryKey: ['leads-combobox', busqueda],
    queryFn: () => buscarLeadsParaCombobox(busqueda),
    enabled: busqueda.trim().length > 0,
  })

  // Click afuera cierra el dropdown, salvo que se esté cargando el alta rápida.
  useEffect(() => {
    if (!abierto) return
    function alClickear(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) {
        setAbierto(false)
        setCreando(false)
      }
    }
    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [abierto])

  function elegir(lead: LeadResumido) {
    onChange(lead.id)
    setTexto('')
    setBusqueda('')
    setAbierto(false)
    setCreando(false)
  }

  // --- Estado seleccionado --------------------------------------------------
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <span className="min-w-0 truncate text-base text-ink">
          {seleccionado
            ? `${seleccionado.nombre} ${seleccionado.apellido ?? ''}`.trim()
            : 'Cargando…'}
          {seleccionado?.telefono && (
            <span className="text-ink-3"> · {seleccionado.telefono}</span>
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

  // --- Estado de búsqueda ---------------------------------------------------
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
            setCreando(false)
          }}
          onFocus={() => setAbierto(true)}
          className={`${CLASES_CONTROL} pl-11`}
        />
      </div>

      {abierto && texto.trim() && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-md">
          {creando ? (
            <FormularioRapido
              textoInicial={texto}
              onCancelar={() => setCreando(false)}
              onCreado={elegir}
            />
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {isFetching && (
                <li className="px-4 py-3 text-sm text-ink-3">Buscando…</li>
              )}

              {!isFetching &&
                resultados?.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => elegir(lead)}
                      className="flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-background motion-reduce:transition-none"
                    >
                      <span className="text-sm font-medium text-ink">
                        {lead.nombre} {lead.apellido ?? ''}
                      </span>
                      <span className="text-xs text-ink-3">
                        {lead.telefono ?? 'Sin teléfono'}
                      </span>
                    </button>
                  </li>
                ))}

              {!isFetching && resultados?.length === 0 && (
                <li className="px-4 py-2.5 text-sm text-ink-3">
                  No encontramos leads con ese nombre o teléfono.
                </li>
              )}

              {/* Siempre disponible mientras haya texto: es la salida cuando
                  el propietario todavía no está cargado en el sistema. */}
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreando(true)}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-brand-softer motion-reduce:transition-none"
                >
                  + Crear lead nuevo: “{texto.trim()}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alta rápida embebida en el dropdown
// ---------------------------------------------------------------------------

/** Parte "Juan Pérez" en nombre y apellido para no hacer retipear al usuario. */
function partirNombre(texto: string): { nombre: string; apellido: string } {
  const partes = texto.trim().split(/\s+/)
  if (partes.length === 1) return { nombre: partes[0], apellido: '' }
  return { nombre: partes[0], apellido: partes.slice(1).join(' ') }
}

function FormularioRapido({
  textoInicial,
  onCancelar,
  onCreado,
}: {
  textoInicial: string
  onCancelar: () => void
  onCreado: (lead: LeadResumido) => void
}) {
  const inicial = partirNombre(textoInicial)
  const [nombre, setNombre] = useState(inicial.nombre)
  const [apellido, setApellido] = useState(inicial.apellido)
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completo = nombre.trim() && apellido.trim() && telefono.trim()

  async function guardar() {
    if (!completo || guardando) return
    setGuardando(true)
    setError(null)
    try {
      // Carga rápida: origen MANUAL y el resto en blanco. El lead nace en
      // estado NULL ("nuevo") como cualquier otro.
      const lead = await crearLead({
        nombre,
        apellido,
        telefono,
        origen: 'MANUAL',
      })
      onCreado({
        id: lead.id,
        nombre: lead.nombre,
        apellido: lead.apellido,
        telefono: lead.telefono,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el lead.')
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-2.5 p-4">
      <p className="text-sm font-semibold text-ink">Crear lead nuevo</p>

      <div className="grid grid-cols-2 gap-2">
        <CampoRapido valor={nombre} onCambiar={setNombre} placeholder="Nombre *" />
        <CampoRapido valor={apellido} onCambiar={setApellido} placeholder="Apellido *" />
      </div>
      <CampoRapido valor={telefono} onCambiar={setTelefono} placeholder="Teléfono *" />

      {error && (
        <p role="alert" className="text-xs text-peligro-ink">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[0.8rem] font-semibold text-ink-3 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
        >
          <IconoCerrar className="size-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!completo || guardando}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-[0.8rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
        >
          {guardando ? 'Creando…' : 'Crear y seleccionar'}
        </button>
      </div>
    </div>
  )
}

function CampoRapido({
  valor,
  onCambiar,
  placeholder,
}: {
  valor: string
  onCambiar: (v: string) => void
  placeholder: string
}) {
  return (
    <input
      type="text"
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onCambiar(e.target.value)}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
    />
  )
}
