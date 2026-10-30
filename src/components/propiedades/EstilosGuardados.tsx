import { useId, useState } from 'react'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { MAX_ESTILOS, MAX_NOMBRE_ESTILO, type EstiloGuardado } from './imagen/estilos'

interface Props {
  estilos: EstiloGuardado[]
  /** Por qué un estilo no se aplicó del todo (por ejemplo, faltan fotos para su plantilla). */
  aviso: string | null
  onAplicar: (estilo: EstiloGuardado) => void
  /** false si no se pudo guardar. */
  onGuardar: (nombre: string) => boolean
  onRenombrar: (id: string, nombre: string) => void
  onBorrar: (id: string) => void
  onPredeterminado: (id: string) => void
}

/** Qué se está escribiendo en el campo de nombre: un estilo nuevo o el nuevo nombre de uno. */
type Edicion = { tipo: 'nuevo' } | { tipo: 'renombrar'; id: string } | null

const CLASE_BOTON_CHIP =
  'inline-flex min-h-9 items-center gap-1.5 px-3 text-[0.82rem] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** "Mis estilos": la identidad de la marca (plantilla, colores, encabezado, agente, firma) a un clic. */
export function EstilosGuardados({
  estilos,
  aviso,
  onAplicar,
  onGuardar,
  onRenombrar,
  onBorrar,
  onPredeterminado,
}: Props) {
  const id = useId()
  const [edicion, setEdicion] = useState<Edicion>(null)
  const [nombre, setNombre] = useState('')
  const lleno = estilos.length >= MAX_ESTILOS

  function empezar(siguiente: Edicion, nombreInicial = '') {
    setEdicion(siguiente)
    setNombre(nombreInicial)
  }

  function confirmar() {
    if (!edicion || nombre.trim() === '') return
    if (edicion.tipo === 'nuevo') {
      if (!onGuardar(nombre)) return
    } else {
      onRenombrar(edicion.id, nombre)
    }
    setEdicion(null)
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <p className="m-0 text-[0.8rem] font-semibold text-ink-2">Mis estilos</p>

      {estilos.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {estilos.map((e) => (
            <li key={e.id} className="inline-flex items-center rounded-full border border-border bg-surface">
              <button
                type="button"
                onClick={() => onAplicar(e)}
                title="Aplicar este estilo"
                className={`${CLASE_BOTON_CHIP} rounded-l-full`}
              >
                {e.nombre}
                {e.predeterminado && (
                  <>
                    <span aria-hidden className="text-primary">★</span>
                    <span className="sr-only">(predeterminado)</span>
                  </>
                )}
              </button>
              <MenuDesplegable
                alinear="derecha"
                etiqueta={`Opciones del estilo ${e.nombre}`}
                claseBoton="inline-flex size-9 items-center justify-center rounded-r-full text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                boton={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                }
                items={[
                  { label: 'Renombrar', onSelect: () => empezar({ tipo: 'renombrar', id: e.id }, e.nombre) },
                  {
                    label: e.predeterminado ? 'Quitar como predeterminado' : 'Usar al abrir el editor',
                    onSelect: () => onPredeterminado(e.id),
                  },
                  { label: 'Borrar', peligro: true, onSelect: () => onBorrar(e.id) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      {edicion ? (
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            confirmar()
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor={`${id}-nombre`} className="sr-only">
            Nombre del estilo
          </label>
          <input
            id={`${id}-nombre`}
            value={nombre}
            maxLength={MAX_NOMBRE_ESTILO}
            autoFocus
            placeholder="Nombre del estilo"
            onChange={(ev) => setNombre(ev.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[0.9rem] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={nombre.trim() === ''}
            className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3.5 text-[0.82rem] font-semibold text-primary-contrast hover:bg-primary-dark disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEdicion(null)}
            className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3.5 text-[0.82rem] font-semibold text-ink-2 hover:text-ink"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => empezar({ tipo: 'nuevo' })}
            disabled={lleno}
            className="inline-flex min-h-9 items-center rounded-lg border border-primary bg-surface px-3.5 text-[0.82rem] font-semibold text-primary hover:bg-brand-softer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar como mi estilo
          </button>
          {lleno && (
            <span className="text-xs text-ink-3">
              Llegaste al máximo de {MAX_ESTILOS} estilos. Borrá uno para guardar otro.
            </span>
          )}
        </div>
      )}

      {aviso && (
        <p role="status" className="m-0 rounded-lg bg-surface px-3 py-2 text-[0.82rem] text-ink-2">
          {aviso}
        </p>
      )}
    </div>
  )
}
