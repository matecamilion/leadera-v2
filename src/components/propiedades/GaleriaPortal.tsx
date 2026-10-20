import { useCallback, useState } from 'react'
import { IconoCasa } from '../leads/Iconos'
import { VisorFotos } from './VisorFotos'

interface Props {
  fotos: string[]
  /** Abre el panel para agregar, elegir portada o eliminar. */
  onGestionar: () => void
}

/** Cuántas fotos chicas entran al lado de la grande en el mosaico. */
const CHICAS = 4

const CLASE_BOTON_ESQUINA =
  'absolute z-10 inline-flex min-h-11 items-center rounded-lg bg-surface/90 px-3.5 py-2 text-[0.82rem] font-semibold text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-surface md:min-h-0 motion-reduce:transition-none'

/**
 * La galería de la ficha, como en un portal inmobiliario: mosaico desde `md` y
 * carrusel con scroll-snap en el celular. Tocar una foto abre el visor.
 */
export function GaleriaPortal({ fotos, onGestionar }: Props) {
  const [indice, setIndice] = useState<number | null>(null)
  const [actual, setActual] = useState(0)

  const cerrar = useCallback(() => setIndice(null), [])
  const anterior = useCallback(
    () => setIndice((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length)),
    [fotos.length],
  )
  const siguiente = useCallback(
    () => setIndice((i) => (i === null ? null : (i + 1) % fotos.length)),
    [fotos.length],
  )

  // Derivado en render: si se borró la última foto con el visor abierto, el
  // índice guardado queda fuera de rango y se trata como cerrado.
  const indiceVisible = indice !== null && indice < fotos.length ? indice : null

  if (fotos.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-14 text-center">
        <IconoCasa className="size-12 text-ink-4" />
        <p className="m-0 mt-3 text-[0.95rem] font-semibold text-ink-2">Todavía no hay fotos</p>
        <button
          type="button"
          onClick={onGestionar}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 py-2 text-[0.85rem] font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
        >
          Agregar fotos
        </button>
      </div>
    )
  }

  const total = fotos.length
  const chicas = fotos.slice(1, 1 + CHICAS)

  return (
    <section aria-label="Fotos de la propiedad" className="relative">
      {/* Desktop: la grande y hasta cuatro chicas. */}
      <div
        className={`hidden gap-2 overflow-hidden rounded-2xl md:grid md:h-[clamp(300px,42vh,420px)] ${
          chicas.length > 0 ? 'grid-cols-[3fr_2fr]' : 'grid-cols-1'
        }`}
      >
        <Tile url={fotos[0]} numero={1} inmediata onAbrir={() => setIndice(0)} />

        {chicas.length > 0 && (
          <div
            className={`grid min-h-0 gap-2 ${
              chicas.length === 1
                ? 'grid-cols-1 grid-rows-1'
                : chicas.length === 2
                  ? 'grid-cols-1 grid-rows-2'
                  : 'grid-cols-2 grid-rows-2'
            }`}
          >
            {chicas.map((url, i) => {
              const esUltima = i === chicas.length - 1 && total > 1 + CHICAS
              return (
                <Tile
                  key={url}
                  url={url}
                  numero={i + 2}
                  ancha={chicas.length === 3 && i === 2}
                  // "Ver las N fotos" abre desde la primera, no desde esta.
                  onAbrir={() => setIndice(esUltima ? 0 : i + 1)}
                  etiqueta={esUltima ? `Ver las ${total} fotos` : undefined}
                />
              )
            })}
          </div>
        )}

        {total > 1 && (
          <button
            type="button"
            onClick={() => setIndice(0)}
            className={`${CLASE_BOTON_ESQUINA} right-3 bottom-3`}
          >
            Ver todas ({total})
          </button>
        )}
      </div>

      {/* Celular: una foto por pantalla. */}
      <div className="relative md:hidden">
        <ul
          onScroll={(e) => {
            const el = e.currentTarget
            const nueva = Math.round(el.scrollLeft / el.clientWidth)
            setActual((previa) => (previa === nueva ? previa : nueva))
          }}
          className="m-0 flex snap-x snap-mandatory list-none overflow-x-auto rounded-2xl p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {fotos.map((url, i) => (
            <li key={url} className="aspect-[4/3] w-full shrink-0 snap-center">
              <Tile url={url} numero={i + 1} inmediata={i === 0} onAbrir={() => setIndice(i)} />
            </li>
          ))}
        </ul>
        {total > 1 && (
          <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
            {actual + 1}/{total}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onGestionar}
        className={`${CLASE_BOTON_ESQUINA} top-3 right-3`}
      >
        Gestionar fotos
      </button>

      {indiceVisible !== null && (
        <VisorFotos
          fotos={fotos}
          indice={indiceVisible}
          onCerrar={cerrar}
          onAnterior={anterior}
          onSiguiente={siguiente}
        />
      )}
    </section>
  )
}

interface TileProps {
  url: string
  numero: number
  onAbrir: () => void
  /** La foto principal carga ya; las demás, cuando se acercan a la pantalla. */
  inmediata?: boolean
  /** Ocupa las dos columnas de la grilla chica. */
  ancha?: boolean
  etiqueta?: string
}

function Tile({ url, numero, onAbrir, inmediata = false, ancha = false, etiqueta }: TileProps) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={etiqueta ?? `Ver foto ${numero}`}
      className={`relative block size-full min-h-0 overflow-hidden bg-surface-2 p-0 ${
        ancha ? 'col-span-2' : ''
      }`}
    >
      <img
        src={url}
        alt=""
        loading={inmediata ? 'eager' : 'lazy'}
        fetchPriority={inmediata ? 'high' : undefined}
        className="size-full object-cover"
      />
      {etiqueta && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-bold text-white">
          {etiqueta}
        </span>
      )}
    </button>
  )
}
