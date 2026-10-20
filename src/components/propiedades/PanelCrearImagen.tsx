import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useEstadoSuscripcion } from '../../hooks/useSuscripcion'
import { etiquetaTipo, formatearPrecio, type PropiedadDetalle } from '../../lib/api/propiedades'
import { IconoCerrar } from '../leads/Iconos'
import {
  CLAVE_AGENTE,
  CLAVE_ENCABEZADO,
  CLAVE_FIRMA,
  guardar,
  leerGuardado,
} from './imagen/almacenamiento'
import { ALTO, ANCHO, OPCIONES_ICONO } from './imagen/constantes'
import { descargarPng, ErrorFotos } from './imagen/exportar'
import { IconoDato } from './imagen/iconos'
import { PALETAS } from './imagen/paletas'
import { PLANTILLAS } from './imagen/registro'
import { SelectorFotos } from './imagen/SelectorFotos'
import type { ClaveIcono, ClavePaleta, DatoImagen } from './imagen/tipos'
import './imagen/fonts-imagen.css'

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
  | 'finalidad'
  | 'fotos_urls'
>

const MAX_TITULO = 24
const MAX_DATO = 24
const MAX_NOTA = 40
const CANTIDAD_DATOS = 4

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

/** `Departamento en Palermo`, sólo si entra en el máximo: si no, que lo escriba el agente. */
function tituloInicial(p: DatosPropiedad): string {
  const zona = p.zona?.trim()
  if (!zona) return ''
  const titulo = `${etiquetaTipo(p.tipo)} en ${zona}`
  return titulo.length <= MAX_TITULO ? titulo : ''
}

/** Ambientes, baños y m² cubiertos cuando existen; el resto de los lugares, vacíos. */
function datosIniciales(p: DatosPropiedad): DatoImagen[] {
  const lista: DatoImagen[] = []
  if (p.ambientes != null) {
    lista.push({ icono: 'ambientes', texto: plural(p.ambientes, 'ambiente', 'ambientes') })
  }
  if (p.banos != null) lista.push({ icono: 'banos', texto: plural(p.banos, 'baño', 'baños') })
  if (p.metros_cubiertos != null) {
    lista.push({ icono: 'm2_cubiertos', texto: `${p.metros_cubiertos} m² cubiertos` })
  }
  while (lista.length < CANTIDAD_DATOS) lista.push({ icono: 'ninguno', texto: '' })
  return lista
}

const CLASES_CONTROL =
  'rounded-lg border border-border bg-surface px-3 py-2 text-[0.9rem] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none'
const CLASES_INPUT = `w-full ${CLASES_CONTROL}`

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

  const cantidadFotos = propiedad.fotos_urls.length
  const alcanzan = (fotos: number) => cantidadFotos >= fotos

  // La primera plantilla que alcanza con las fotos que hay; si ninguna, la primera.
  const [plantillaId, setPlantillaId] = useState(
    () => (PLANTILLAS.find((p) => alcanzan(p.fotos)) ?? PLANTILLAS[0]).id,
  )
  const plantilla = PLANTILLAS.find((p) => p.id === plantillaId) ?? PLANTILLAS[0]

  const sinFinalidad = propiedad.finalidad == null || propiedad.finalidad === 'AMBAS'
  const [etiqueta, setEtiqueta] = useState(
    propiedad.finalidad === 'ALQUILER' ? 'EN ALQUILER' : 'EN VENTA',
  )
  const [titulo, setTitulo] = useState(() => tituloInicial(propiedad))
  const [datos, setDatos] = useState(() => datosIniciales(propiedad))
  const [nota, setNota] = useState('')
  const [claveDePaleta, setClaveDePaleta] = useState<ClavePaleta>(plantilla.paletaInicial)
  // Una paleta elegida a mano se mantiene al cambiar de plantilla.
  const [paletaManual, setPaletaManual] = useState(false)
  const [conDireccion, setConDireccion] = useState(false)
  // Hasta que se edita, el encabezado es el nombre de la inmobiliaria, que puede
  // llegar después de abrir el panel.
  const [encabezadoEditado, setEncabezadoEditado] = useState<string | null>(() =>
    leerGuardado(CLAVE_ENCABEZADO),
  )
  const [agente, setAgente] = useState(
    () => leerGuardado(CLAVE_AGENTE) ?? (profile ? `${profile.nombre} ${profile.apellido}` : ''),
  )
  const [firma, setFirma] = useState(() => leerGuardado(CLAVE_FIRMA) ?? '')
  const [elegidas, setElegidas] = useState<string[]>(() =>
    propiedad.fotos_urls.slice(0, plantilla.fotos),
  )
  const [generando, setGenerando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const paleta = PALETAS.find((p) => p.clave === claveDePaleta) ?? PALETAS[0]
  const encabezado = encabezadoEditado ?? inmobiliaria ?? ''
  const sinTitulo = titulo.trim() === ''
  const listo = alcanzan(plantilla.fotos) && elegidas.length === plantilla.fotos && !sinTitulo

  const precio =
    propiedad.precio == null ? 'Consultar' : formatearPrecio(propiedad.precio, propiedad.moneda)

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

  function cambiarPlantilla(nuevaId: string) {
    const nueva = PLANTILLAS.find((p) => p.id === nuevaId)
    if (!nueva) return
    setPlantillaId(nuevaId)
    if (!paletaManual) setClaveDePaleta(nueva.paletaInicial)
    // Se conservan las ya elegidas y se completa con las primeras que falten.
    setElegidas((actuales) => {
      const conservadas = actuales.slice(0, nueva.fotos)
      const faltan = propiedad.fotos_urls.filter((u) => !conservadas.includes(u))
      return [...conservadas, ...faltan].slice(0, nueva.fotos)
    })
  }

  function cambiarDato(i: number, cambios: Partial<DatoImagen>) {
    setDatos((actuales) => actuales.map((d, j) => (j === i ? { ...d, ...cambios } : d)))
  }

  function alternarFoto(url: string) {
    setElegidas((actuales) => {
      if (actuales.includes(url)) return actuales.filter((u) => u !== url)
      return actuales.length < plantilla.fotos ? [...actuales, url] : actuales
    })
  }

  async function descargar() {
    const raiz = nodo.current
    if (!raiz || generando) return
    setAviso(null)
    setGenerando(true)
    try {
      const nombre =
        [sanear(propiedad.zona ?? ''), sanear(etiquetaTipo(propiedad.tipo))]
          .filter(Boolean)
          .join('-') || 'propiedad'
      await descargarPng(raiz, nombre)
    } catch (e) {
      setAviso(
        e instanceof ErrorFotos
          ? 'No se pudo cargar alguna de las fotos. Probá de nuevo o elegí otras.'
          : 'No se pudo generar la imagen. Probá de nuevo.',
      )
    } finally {
      setGenerando(false)
    }
  }

  const { Componente } = plantilla

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

      <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[0.8rem] font-semibold text-ink-2">Plantilla</legend>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS.map((p) => {
            const deshabilitada = !alcanzan(p.fotos)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => cambiarPlantilla(p.id)}
                disabled={deshabilitada}
                aria-pressed={plantillaId === p.id}
                className={`inline-flex flex-col items-start rounded-lg border bg-surface px-3 py-1.5 text-left text-[0.82rem] font-semibold text-ink disabled:opacity-60 ${
                  plantillaId === p.id ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
              >
                {p.nombre}
                {deshabilitada && (
                  <span className="text-[0.72rem] font-normal text-ink-3">
                    Necesita {p.fotos} fotos
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Campo id={`${id}-titulo`} label="Título" contador={`${titulo.length}/${MAX_TITULO}`}>
            <input
              id={`${id}-titulo`}
              value={titulo}
              maxLength={MAX_TITULO}
              onChange={(e) => setTitulo(e.target.value)}
              className={CLASES_INPUT}
            />
            {sinTitulo && <p className="m-0 text-xs text-peligro-ink">Escribí un título</p>}
          </Campo>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[0.8rem] font-semibold text-ink-2">
              Datos (hasta {CANTIDAD_DATOS})
            </legend>
            <div className="flex flex-col gap-2">
              {datos.map((dato, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-primary">
                      <IconoDato clave={dato.icono} tamano={18} />
                    </span>
                    <select
                      value={dato.icono}
                      onChange={(e) => cambiarDato(i, { icono: e.target.value as ClaveIcono })}
                      aria-label={`Ícono del dato ${i + 1}`}
                      className={`w-40 pl-9 ${CLASES_CONTROL}`}
                    >
                      {OPCIONES_ICONO.map((o) => (
                        <option key={o.clave} value={o.clave}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={dato.texto}
                    maxLength={MAX_DATO}
                    onChange={(e) => cambiarDato(i, { texto: e.target.value })}
                    aria-label={`Dato ${i + 1}`}
                    placeholder={`Dato ${i + 1}`}
                    className={`min-w-0 flex-1 ${CLASES_CONTROL}`}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <Campo id={`${id}-nota`} label="Nota" contador={`${nota.length}/${MAX_NOTA}`}>
            <input
              id={`${id}-nota`}
              value={nota}
              maxLength={MAX_NOTA}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: Permuta a evaluar"
              className={CLASES_INPUT}
            />
          </Campo>

          <Campo id={`${id}-encabezado`} label="Encabezado">
            <input
              id={`${id}-encabezado`}
              value={encabezado}
              onChange={(e) => {
                setEncabezadoEditado(e.target.value)
                guardar(CLAVE_ENCABEZADO, e.target.value)
              }}
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
            <div className="grid w-fit grid-cols-4 gap-3">
              {PALETAS.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => {
                    setClaveDePaleta(p.clave)
                    setPaletaManual(true)
                  }}
                  aria-pressed={claveDePaleta === p.clave}
                  aria-label={p.nombre}
                  className={`size-9 rounded-full border-4 ${
                    claveDePaleta === p.clave
                      ? 'ring-2 ring-primary ring-offset-2'
                      : 'ring-1 ring-border'
                  }`}
                  style={{ background: p.acento, borderColor: p.fondo }}
                />
              ))}
            </div>
            <p className="m-0 mt-2 text-[0.8rem] text-ink-3">{paleta.nombre}</p>
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
            <SelectorFotos
              fotos={propiedad.fotos_urls}
              elegidas={elegidas}
              cantidad={plantilla.fotos}
              onAlternar={alternarFoto}
            />
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
              <Componente
                d={{
                  fotos: elegidas,
                  titulo: titulo.trim(),
                  datos: datos
                    .map((d) => ({ icono: d.icono, texto: d.texto.trim() }))
                    .filter((d) => d.texto),
                  nota: nota.trim(),
                  encabezado: encabezado.trim(),
                  etiqueta,
                  zona: propiedad.zona?.trim() ?? '',
                  direccion: conDireccion ? propiedad.direccion.trim() : '',
                  precio,
                  agente: agente.trim(),
                  firma: firma.trim(),
                  paleta,
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
