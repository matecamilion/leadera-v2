import type { CSSProperties } from 'react'
import {
  ALTO,
  ANCHO,
  DORADO,
  FAMILIA_TITULO,
  PALETAS,
  type ClavePaleta,
} from './constantesImagen'

export interface DatosPlantilla {
  /** Las tres fotos elegidas, en orden: grande, izquierda, derecha. */
  fotos: (string | undefined)[]
  titulo: string
  extra: string
  etiqueta: string
  paleta: ClavePaleta
  ubicacion: string
  /** Ya armados ("3 ambientes", "2 baños"…), sólo los que tienen valor. */
  datos: string[]
  inmobiliaria: string | null
  precio: string
  agente: string
  firma: string
}

const unaLinea: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function Foto({ src, estilo }: { src: string | undefined; estilo?: CSSProperties }) {
  return src ? (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', ...estilo }}
    />
  ) : (
    <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.12)' }} />
  )
}

/**
 * La pieza de 1080×1350. Es el nodo que se exporta: mide eso en píxeles reales
 * y la vista previa lo achica por fuera con transform.
 */
export function PlantillaImagen({ d }: { d: DatosPlantilla }) {
  const fondo = PALETAS.find((p) => p.clave === d.paleta)?.fondo ?? PALETAS[0].fondo

  return (
    <div
      style={{
        width: ANCHO,
        height: ALTO,
        display: 'grid',
        gridTemplateRows: '486px 280px 1fr 190px',
        background: fondo,
        color: '#fff',
        fontFamily: '"Figtree Variable", system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <Foto src={d.fotos[0]} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          columnGap: 40,
          padding: '28px 48px',
          background: fondo,
          borderTop: `6px solid ${DORADO}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '6px 18px',
              background: DORADO,
              color: fondo,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 3,
            }}
          >
            {d.etiqueta}
          </span>

          {d.titulo && (
            <div
              style={{
                fontFamily: FAMILIA_TITULO,
                fontWeight: 700,
                fontSize: 50,
                lineHeight: 1.1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              {d.titulo}
            </div>
          )}

          {d.ubicacion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 28 }}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke={DORADO}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <span style={{ ...unaLinea, minWidth: 0 }}>{d.ubicacion}</span>
            </div>
          )}
        </div>

        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 10,
            paddingLeft: 32,
            borderLeft: `2px solid ${DORADO}`,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {d.datos.map((dato) => (
            <div key={dato} style={unaLinea}>
              {dato}
            </div>
          ))}
          {d.extra && (
            <div style={{ ...unaLinea, color: DORADO, fontWeight: 700 }}>{d.extra}</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 8,
          overflow: 'hidden',
        }}
      >
        <Foto src={d.fotos[1]} />
        <Foto src={d.fotos[2]} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          columnGap: 24,
          padding: '0 48px',
          background: fondo,
          borderTop: `6px solid ${DORADO}`,
        }}
      >
        <div style={{ ...unaLinea, fontSize: 28, fontWeight: 700 }}>{d.inmobiliaria}</div>

        <div
          style={{
            fontFamily: FAMILIA_TITULO,
            fontWeight: 700,
            fontSize: 54,
            color: DORADO,
            whiteSpace: 'nowrap',
          }}
        >
          {d.precio}
        </div>

        <div style={{ minWidth: 0, textAlign: 'right' }}>
          {d.agente && <div style={{ ...unaLinea, fontSize: 28, fontWeight: 700 }}>{d.agente}</div>}
          {d.firma && (
            <div style={{ ...unaLinea, fontSize: 22, marginTop: 4, opacity: 0.85 }}>{d.firma}</div>
          )}
        </div>
      </div>
    </div>
  )
}
