interface Props {
  /** Todas las fotos de la propiedad. */
  fotos: string[]
  elegidas: string[]
  /** Cuántas pide la plantilla. */
  cantidad: number
  onAlternar: (url: string) => void
}

export function SelectorFotos({ fotos, elegidas, cantidad, onAlternar }: Props) {
  if (fotos.length < cantidad) {
    return (
      <p className="m-0 rounded-lg bg-surface px-3 py-2.5 text-[0.84rem] text-ink-2">
        Necesitás al menos {cantidad} fotos para crear la imagen
      </p>
    )
  }

  return (
    <>
      <p className="m-0 mb-2 text-[0.78rem] text-ink-3">
        Tocá {cantidad} fotos en el orden en que van: la 1 es la principal.
      </p>
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-5">
        {fotos.map((url, i) => {
          const posicion = elegidas.indexOf(url)
          return (
            <li key={url} className="relative">
              <button
                type="button"
                onClick={() => onAlternar(url)}
                aria-pressed={posicion !== -1}
                aria-label={`Foto ${i + 1}${posicion !== -1 ? `, elegida en el lugar ${posicion + 1}` : ''}`}
                className={`block aspect-square w-full overflow-hidden rounded-lg border-2 p-0 ${
                  posicion !== -1 ? 'border-primary' : 'border-transparent'
                }`}
              >
                <img src={url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
              {posicion !== -1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1 left-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-contrast"
                >
                  {posicion + 1}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
