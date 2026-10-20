import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useEstadoSuscripcion } from '../../hooks/useSuscripcion'
import { etiquetaTipo, formatearPrecio, type PropiedadDetalle } from '../../lib/api/propiedades'
import { IconoCerrar } from '../leads/Iconos'
import { ALTO, ANCHO, FAMILIA_TITULO, PALETAS, type ClavePaleta } from './constantesImagen'
import { PlantillaImagen } from './PlantillaImagen'
import './fonts-imagen.css'

type DatosPropiedad = Pick<
  PropiedadDetalle,
  | 'tipo'
  | 'zona'
  | 'direccion'
  | 'precio'
  | 'moneda'
  | 'ambientes'
  | 'banos'
  | 'metros_cubiertos'
  | 'cocheras'
  | 'finalidad'
  | 'fotos_urls'
>

const MAX_TITULO = 28
const MAX_EXTRA = 40
const FOTOS_NECESARIAS = 3

const CLAVE_AGENTE = 'leadera-imagen-agente'
const CLAVE_FIRMA = 'leadera-imagen-firma'

/** En try/catch por lo mismo que el resto de la app: sin storage, el campo anda igual. */
function leerGuardado(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // No se recuerda para la próxima. Es molesto, no roto.
  }
}

function sanear(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** Resuelve cuando la imagen ya cargó; rechaza si falló o tarda de más. */
function imagenCargada(img: HTMLImageElement): Promise<void> {
  if (img.complete) {
    return img.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error('foto'))
  }
  return new Promise((resolver, rechazar) => {
    const limite = window.setTimeout(() => rechazar(new Error('foto')), 15_000)
    img.addEventListener('load', () => {
      window.clearTimeout(limite)
      resolver()
    })
    img.addEventListener('error', () => {
      window.clearTimeout(limite)
      rechazar(new Error('foto'))
    })
  })
}

const CLASES_INPUT =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.9rem] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none'

/**
 * Arma una pieza de 1080×1350 para Instagram a partir de la propiedad y la
 * baja como PNG. Todo pasa en el navegador: no se guarda nada en la base.
 */
export default function PanelCrearImagen({
  propiedad,
  onCerrar,
}: {
  propiedad: DatosPropiedad
  onCerrar: () => void
}) {
  const { profile } = useAuth()
  const inmobiliaria = useEstadoSuscripcion().data?.nombre ?? null
  const id = useId()

  const sinFinalidad = propiedad.finalidad == null || propiedad.finalidad === 'AMBAS'
  const [etiqueta, setEtiqueta] = useState(
    propiedad.finalidad === 'ALQUILER' ? 'EN ALQUILER' : 'EN VENTA',
  )
  const [titulo, setTitulo] = useState('')
  const [extra, setExtra] = useState('')
  const [paleta, setPaleta] = useState<ClavePaleta>('verde')
  const [conDireccion, setConDireccion] = useState(false)
  const [agente, setAgente] = useState(
    () => leerGuardado(CLAVE_AGENTE) ?? (profile ? `${profile.nombre} ${profile.apellido}` : ''),
  )
  const [firma, setFirma] = useState(() => leerGuardado(CLAVE_FIRMA) ?? '')
  const [elegidas, setElegidas] = useState<string[]>(() =>
    propiedad.fotos_urls.slice(0, FOTOS_NECESARIAS),
  )
  const [generando, setGenerando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const faltanFotos = propiedad.fotos_urls.length < FOTOS_NECESARIAS
  const listo = !faltanFotos && elegidas.length === FOTOS_NECESARIAS

  const datos = useMemo(() => {
    const lista: string[] = []
    if (propiedad.ambientes != null) lista.push(plural(propiedad.ambientes, 'ambiente', 'ambientes'))
    if (propiedad.banos != null) lista.push(plural(propiedad.banos, 'baño', 'baños'))
    if (propiedad.metros_cubiertos != null) lista.push(`${propiedad.metros_cubiertos} m² cubiertos`)
    if (propiedad.cocheras != null) lista.push(plural(propiedad.cocheras, 'cochera', 'cocheras'))
    return lista
  }, [propiedad.ambientes, propiedad.banos, propiedad.metros_cubiertos, propiedad.cocheras])

  const ubicacion = conDireccion
    ? [propiedad.direccion, propiedad.zona].filter(Boolean).join(', ')
    : (propiedad.zona ?? '')

  // --- Vista previa: el nodo mide 1080×1350 y se achica con transform --------
  const contenedor = useRef<HTMLDivElement>(null)
  const nodo = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.3)

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const medir = () => setEscala(el.clientWidth / ANCHO)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  function alternarFoto(url: string) {
    setElegidas((actuales) => {
      if (actuales.includes(url)) return actuales.filter((u) => u !== url)
      return actuales.length < FOTOS_NECESARIAS ? [...actuales, url] : actuales
    })
  }

  async function descargar() {
    const raiz = nodo.current
    if (!raiz || generando) return
    setAviso(null)
    setGenerando(true)
    try {
      // Con la serif y la sans listas, y las fotos cargadas: si no, la imagen
      // sale con la tipografía de reemplazo o con huecos.
      await document.fonts.load(`700 50px ${FAMILIA_TITULO}`)
      await document.fonts.ready
      try {
        await Promise.all(Array.from(raiz.querySelectorAll('img')).map(imagenCargada))
      } catch {
        setAviso('No se pudo cargar alguna de las fotos. Probá de nuevo o elegí otras.')
        return
      }

      // Se carga el módulo recién ahora: html-to-image no viaja con el panel.
      const { toPng } = await import('html-to-image')
      const opciones = {
        width: ANCHO,
        height: ALTO,
        pixelRatio: 1,
        // Sin esto el navegador puede reusar la foto cacheada sin CORS de la
        // galería, y el fetch de la exportación falla.
        cacheBust: true,
        style: { transform: 'none' },
      }
      // Safari/iOS dibuja vacías las imágenes en la primera pasada.
      await toPng(raiz, opciones)
      const png = await toPng(raiz, opciones)

      const nombre = [sanear(propiedad.zona ?? ''), sanear(etiquetaTipo(propiedad.tipo))]
        .filter(Boolean)
        .join('-')
      const ancla = document.createElement('a')
      ancla.href = png
      ancla.download = `${nombre || 'propiedad'}.png`
      document.body.appendChild(ancla)
      ancla.click()
      ancla.remove()
    } catch {
      setAviso('No se pudo generar la imagen. Probá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <section
      aria-label="Crear imagen para publicar"
      className="mb-6 rounded-2xl bg-brand-softer px-4 py-4 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">Crear imagen</h2>
          <p className="m-0 mt-0.5 text-[0.8rem] text-ink-3">
            Una pieza lista para Instagram (1080×1350). No se guarda: la descargás y listo.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el panel de la imagen"
          className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Campo id={`${id}-titulo`} label="Título" contador={`${titulo.length}/${MAX_TITULO}`}>
            <input
              id={`${id}-titulo`}
              value={titulo}
              maxLength={MAX_TITULO}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Opcional"
              className={CLASES_INPUT}
            />
          </Campo>

          <Campo id={`${id}-extra`} label="Texto extra" contador={`${extra.length}/${MAX_EXTRA}`}>
            <input
              id={`${id}-extra`}
              value={extra}
              maxLength={MAX_EXTRA}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Ej.: Permuta a evaluar"
              className={CLASES_INPUT}
            />
          </Campo>

          {sinFinalidad && (
            <Campo id={`${id}-etiqueta`} label="Etiqueta">
              <select
                id={`${id}-etiqueta`}
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                className={CLASES_INPUT}
              >
                <option value="EN VENTA">En venta</option>
                <option value="EN ALQUILER">En alquiler</option>
              </select>
            </Campo>
          )}

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[0.8rem] font-semibold text-ink-2">Paleta</legend>
            <div className="flex flex-wrap gap-2">
              {PALETAS.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => setPaleta(p.clave)}
                  aria-pressed={paleta === p.clave}
                  className={`inline-flex items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 text-[0.82rem] font-semibold text-ink ${
                    paleta === p.clave ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-4 rounded-full border border-border"
                    style={{ background: p.fondo }}
                  />
                  {p.nombre}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2.5 text-[0.88rem] font-semibold text-ink">
            <input
              type="checkbox"
              role="switch"
              checked={conDireccion}
              onChange={(e) => setConDireccion(e.target.checked)}
              className="size-4 accent-primary"
            />
            Mostrar dirección completa
          </label>

          <Campo id={`${id}-agente`} label="Agente">
            <input
              id={`${id}-agente`}
              value={agente}
              onChange={(e) => {
                setAgente(e.target.value)
                guardar(CLAVE_AGENTE, e.target.value)
              }}
              className={CLASES_INPUT}
            />
          </Campo>

          <Campo id={`${id}-firma`} label="Firma">
            <input
              id={`${id}-firma`}
              value={firma}
              onChange={(e) => {
                setFirma(e.target.value)
                guardar(CLAVE_FIRMA, e.target.value)
              }}
              placeholder="Nombre, @usuario, matrícula"
              className={CLASES_INPUT}
            />
          </Campo>

          <div>
            <p className="m-0 mb-1.5 text-[0.8rem] font-semibold text-ink-2">Fotos</p>
            {faltanFotos ? (
              <p className="m-0 rounded-lg bg-surface px-3 py-2.5 text-[0.84rem] text-ink-2">
                Necesitás al menos 3 fotos para crear la imagen
              </p>
            ) : (
              <>
                <p className="m-0 mb-2 text-[0.78rem] text-ink-3">
                  Tocá hasta 3: la 1 es la grande de arriba, la 2 y la 3 van abajo.
                </p>
                <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-5">
                  {propiedad.fotos_urls.map((url, i) => {
                    const posicion = elegidas.indexOf(url)
                    return (
                      <li key={url} className="relative">
                        <button
                          type="button"
                          onClick={() => alternarFoto(url)}
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
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div
            ref={contenedor}
            className="relative w-full overflow-hidden rounded-lg border border-border"
            style={{ height: ALTO * escala }}
          >
            <div
              ref={nodo}
              style={{ width: ANCHO, height: ALTO, transform: `scale(${escala})`, transformOrigin: 'top left' }}
            >
              <PlantillaImagen
                d={{
                  fotos: elegidas,
                  titulo: titulo.trim(),
                  extra: extra.trim(),
                  etiqueta,
                  paleta,
                  ubicacion,
                  datos,
                  inmobiliaria,
                  precio:
                    propiedad.precio == null
                      ? 'Consultar'
                      : formatearPrecio(propiedad.precio, propiedad.moneda),
                  agente: agente.trim(),
                  firma: firma.trim(),
                }}
              />
            </div>
          </div>

          {aviso && (
            <p
              role="alert"
              className="m-0 rounded-lg bg-peligro-soft px-3.5 py-2.5 text-[0.84rem] text-peligro-ink"
            >
              {aviso}
            </p>
          )}

          <button
            type="button"
            onClick={descargar}
            disabled={!listo || generando}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.88rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {generando ? 'Generando…' : 'Descargar imagen'}
          </button>
        </div>
      </div>
    </section>
  )
}

function Campo({
  id,
  label,
  contador,
  children,
}: {
  id: string
  label: string
  contador?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.8rem] font-semibold text-ink-2">
          {label}
        </label>
        {contador && <span className="text-xs text-ink-3 tabular-nums">{contador}</span>}
      </div>
      {children}
    </div>
  )
}
