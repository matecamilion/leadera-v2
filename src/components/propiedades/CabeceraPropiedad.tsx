import { useState, type ReactNode } from 'react'
import {
  etiquetaTipo,
  formatearExpensas,
  formatearPrecio,
  type EstadoPropiedad,
  type PropiedadDetalle,
} from '../../lib/api/propiedades'
import { formatearFecha } from '../../lib/formatoFecha'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { IconoCalendario, IconoLapiz, IconoLink, IconoTacho } from '../leads/Iconos'
import { CLAVE_FLYER_VISTO, guardar, leerGuardado } from './imagen/almacenamiento'
import { MenuEstadoPropiedad } from './MenuEstadoPropiedad'

interface Props {
  propiedad: PropiedadDetalle
  guardandoEstado: boolean
  onCambiarEstado: (estado: EstadoPropiedad) => void
  onAgendarVisita: () => void
  onEditar: () => void
  onCrearImagen: () => void
  onExportarFicha: () => void
  onLinkConsultas: () => void
  onEliminar: () => void
}

/** Días desde el alta, para el "N días en mercado". */
function diasEnMercado(iso: string): number {
  const alta = new Date(iso)
  if (Number.isNaN(alta.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - alta.getTime()) / 86_400_000))
}

const CLASE_BOTON =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[0.82rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background sm:min-h-0 sm:px-3.5 sm:py-2 md:h-10 md:py-0 motion-reduce:transition-none'

/** Desde `md` sólo el ícono: un cuadrado de 40 px. */
const CLASE_BOTON_ICONO = `${CLASE_BOTON} min-w-11 md:w-10 md:min-w-0 md:px-0`

/** El texto se ve entre `sm` y `md`; desde `md` queda sólo el ícono. */
function EtiquetaHastaMd({ children }: { children: ReactNode }) {
  return <span className="hidden sm:inline md:hidden">{children}</span>
}

/**
 * Tooltip nativo de un botón de menú que no tiene prop `title`: la envoltura
 * cubre todo el botón desde `md`, que es cuando queda sólo el ícono.
 */
function ConTitulo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <span title={titulo} className="inline-flex items-center gap-1.5 md:size-full md:justify-center">
      {children}
    </span>
  )
}

/**
 * Dirección, precio y acciones: lo primero que se lee de la propiedad.
 *
 * En el celular todo va apilado. Desde `md` es un grid de dos columnas: arriba
 * el contexto (tipo, estado, publicación) y las acciones; abajo la dirección
 * y el precio.
 */
export function CabeceraPropiedad({
  propiedad,
  guardandoEstado,
  onCambiarEstado,
  onAgendarVisita,
  onEditar,
  onCrearImagen,
  onExportarFicha,
  onLinkConsultas,
  onEliminar,
}: Props) {
  // El "Nuevo" del botón de flyer desaparece la primera vez que se lo toca.
  const [flyerVisto, setFlyerVisto] = useState(() => leerGuardado(CLAVE_FLYER_VISTO) === '1')
  const dias = diasEnMercado(propiedad.created_at)
  const publicada = `Publicada ${formatearFecha(propiedad.created_at)} · ${
    dias === 1 ? '1 día' : `${dias} días`
  } en mercado`

  return (
    <header className="mb-5 md:mb-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-4 md:gap-y-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:col-start-1 md:row-start-1 md:mb-0 md:min-w-0">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.72rem] font-bold text-ink-2 uppercase">
          {etiquetaTipo(propiedad.tipo)}
        </span>
        <MenuEstadoPropiedad
          actual={propiedad.estado}
          guardando={guardandoEstado}
          onCambiar={onCambiarEstado}
        />
      </div>

      <div className="md:col-start-1 md:row-start-2 md:min-w-0">
        <h1 className="m-0 text-[1.6rem] leading-tight font-extrabold text-ink break-words sm:text-[2rem] md:line-clamp-2 md:text-[1.75rem]">
          {propiedad.direccion}
        </h1>
        {/* Desde md la publicación va en la línea de la zona, que es la que se
            corta con elipsis; en el celular va debajo del precio. */}
        <div className="md:mt-0.5 md:flex md:items-baseline md:gap-x-2">
          {propiedad.zona && (
            <p className="m-0 mt-1 min-w-0 text-[0.95rem] text-ink-3 md:mt-0 md:truncate">
              {propiedad.zona}
            </p>
          )}
          <span className="hidden shrink-0 text-xs whitespace-nowrap text-ink-3 md:inline">
            {propiedad.zona ? '· ' : ''}
            {publicada}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 md:col-start-2 md:row-start-2 md:mt-0 md:flex-col md:items-end md:gap-y-0.5">
        <span
          className={`text-[1.9rem] leading-none font-extrabold tabular-nums md:text-[1.75rem] md:whitespace-nowrap ${
            propiedad.precio == null ? 'text-ink md:text-ink-3' : 'text-ink'
          }`}
        >
          {propiedad.precio == null
            ? 'Precio a consultar'
            : formatearPrecio(propiedad.precio, propiedad.moneda)}
        </span>
        {propiedad.expensas != null && (
          <span className="text-[0.82rem] text-ink-3">
            + expensas {formatearExpensas(propiedad.expensas)} /mes
          </span>
        )}
      </div>

      <p className="m-0 mt-2 text-xs text-ink-3 md:hidden">{publicada}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2 md:col-start-2 md:row-start-1 md:mt-0 md:flex-nowrap md:justify-end">
        <button
          type="button"
          onClick={onAgendarVisita}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[0.82rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark sm:min-h-0 sm:flex-none sm:px-3.5 sm:py-2 md:h-10 md:py-0 motion-reduce:transition-none"
        >
          <IconoCalendario className="size-4 shrink-0" />
          {/* A 320 px no entra el texto entero. */}
          <span className="min-[360px]:hidden">Agendar</span>
          <span className="hidden min-[360px]:inline">Agendar visita</span>
        </button>

        {/* Debajo de sm va en una fila propia, a todo el ancho. */}
        <button
          type="button"
          onClick={() => {
            if (!flyerVisto) {
              setFlyerVisto(true)
              guardar(CLAVE_FLYER_VISTO, '1')
            }
            onCrearImagen()
          }}
          className="relative order-last inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-primary bg-surface px-3.5 text-[0.82rem] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-brand-softer sm:order-none sm:min-h-0 sm:w-auto sm:py-2 md:h-10 md:py-0 motion-reduce:transition-none"
        >
          <IconoFlyer />
          Crear flyer
          {!flyerVisto && (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1.5 right-3 rounded-full bg-primary px-1.5 py-px text-[0.62rem] leading-tight font-bold text-primary-contrast uppercase sm:-right-1 sm:-top-2"
            >
              Nuevo
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onEditar}
          aria-label="Editar propiedad"
          title="Editar propiedad"
          className={CLASE_BOTON_ICONO}
        >
          <IconoLapiz className="size-4" />
          <EtiquetaHastaMd>Editar</EtiquetaHastaMd>
        </button>

        <MenuDesplegable
          etiqueta="Compartir"
          alinear="derecha"
          claseBoton={CLASE_BOTON_ICONO}
          boton={
            <ConTitulo titulo="Compartir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="18" cy="5" r="2.5" />
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="18" cy="19" r="2.5" />
                <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
              </svg>
              <EtiquetaHastaMd>Compartir</EtiquetaHastaMd>
            </ConTitulo>
          }
          items={[
            { label: 'Exportar ficha', icono: <IconoDescarga />, onSelect: onExportarFicha },
            {
              label: 'Link de consultas',
              icono: <IconoLink className="size-4" />,
              onSelect: onLinkConsultas,
            },
          ]}
        />

        <MenuDesplegable
          etiqueta="Más acciones"
          alinear="derecha"
          claseBoton={CLASE_BOTON_ICONO}
          boton={
            <ConTitulo titulo="Más acciones">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </ConTitulo>
          }
          items={[
            {
              label: 'Eliminar propiedad',
              icono: <IconoTacho className="size-4" />,
              onSelect: onEliminar,
              peligro: true,
            },
          ]}
        />
      </div>
    </header>
  )
}

function IconoFlyer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 12h14" />
      <circle cx="9.5" cy="7.5" r="1.2" />
      <path d="M8.5 16h7M8.5 18.5h4" />
    </svg>
  )
}

function IconoDescarga() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}
