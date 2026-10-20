import type { CSSProperties } from 'react'
import { ALTO, ANCHO, FAMILIA_SANS } from '../constantes'
import { Foto } from '../Foto'
import { IconoDato } from '../iconos'
import { TextoAjustado } from '../TextoAjustado'
import { bordeDeFoto } from '../paletas'
import type { DatosImagen } from '../tipos'

const MARGEN_TEXTO = 40
const MARGEN_FOTOS = 24
const SEPARACION_FOTOS = 6

/**
 * Altos fijos de las fotos: no cambian con lo que se escriba. Los demás bloques
 * también son de alto fijo, así que los 28 px que sobran de los 1350 (ver la
 * suma en `Moderno`) quedan como aire entre ellos.
 */
const ALTO_FOTO_PRINCIPAL = 440
const ALTO_MINIATURAS = 290

/** Una sola línea que se corta con elipsis en vez de pisar lo de al lado. */
const unaLinea: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** Alto fijo, y lo que haya adentro queda centrado: sin bandas vacías pegadas a la foto. */
const bloque: CSSProperties = {
  boxSizing: 'border-box',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

/**
 * Moderno: grotesca ultra negra, tinta sobre crema, sin rellenos de color.
 *
 * Presupuesto vertical (px): fila superior 84 + bloque del título 280 (título
 * 250 a la izquierda; zona, dirección y datos a la derecha) + fotos 736
 * (principal 440, separación 6, miniaturas 290) + línea 28 + pie 170
 * + margen 24 = 1322.
 */
export function Moderno({ d }: { d: DatosImagen }) {
  const { fondo, tinta, acento, acentoTexto, sobreAcento } = d.paleta
  const [principal, ...chicas] = d.fotos
  const borde = bordeDeFoto(d.paleta)

  const verticalFina = (
    <div style={{ flexShrink: 0, width: 4, height: 110, background: acento }} />
  )

  return (
    <div
      style={{
        width: ANCHO,
        height: ALTO,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        paddingBottom: 24,
        background: fondo,
        color: tinta,
        fontFamily: FAMILIA_SANS,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          ...bloque,
          height: 84,
          padding: `28px ${MARGEN_TEXTO}px 0`,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: '0 20px',
            height: 44,
            lineHeight: '44px',
            background: acento,
            color: sobreAcento,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {d.etiqueta}
        </div>
        <div style={{ flex: 1, height: 4, background: acento }} />
        {d.encabezado && (
          <div style={{ ...unaLinea, maxWidth: 480, fontSize: 28, fontWeight: 800 }}>
            {d.encabezado}
          </div>
        )}
      </div>

      <div
        style={{
          ...bloque,
          height: 280,
          padding: `0 ${MARGEN_TEXTO}px`,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <div style={{ flexShrink: 0, width: 580 }}>
          <TextoAjustado
            texto={d.titulo}
            tamanoMax={128}
            tamanoMin={40}
            altoMax={250}
            interlineado={0.92}
            style={{
              fontFamily: FAMILIA_SANS,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              textAlign: 'left',
              color: acentoTexto,
              // Los palos de letras como "p" o "y" sobresalen de la última línea.
              paddingBottom: 10,
            }}
          />
        </div>

        <div style={{ flexShrink: 0, width: 4, height: 220, margin: '0 20px', background: acento }} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {d.zona && (
            <div
              style={{
                ...unaLinea,
                height: 44,
                lineHeight: '44px',
                fontSize: 34,
                fontWeight: 800,
              }}
            >
              {d.zona}
            </div>
          )}

          {d.direccion && (
            <div style={{ ...unaLinea, height: 34, lineHeight: '34px', fontSize: 26 }}>
              {d.direccion}
            </div>
          )}

          {d.datos.length > 0 && (d.zona || d.direccion) && (
            <div style={{ height: 4, margin: '9px 0', background: acento }} />
          )}

          {d.datos.map((dato, i) => (
            <div
              key={`${i}-${dato.texto}`}
              style={{ height: 42, display: 'flex', alignItems: 'center', gap: 12 }}
            >
              {dato.icono !== 'ninguno' && (
                <div
                  style={{
                    flexShrink: 0,
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: acento,
                    color: sobreAcento,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconoDato clave={dato.icono} tamano={22} />
                </div>
              )}
              <div style={{ ...unaLinea, minWidth: 0, lineHeight: '42px', fontSize: 26, fontWeight: 500 }}>
                {dato.texto}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          margin: `0 ${MARGEN_FOTOS}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: SEPARACION_FOTOS,
        }}
      >
        <div style={{ height: ALTO_FOTO_PRINCIPAL, overflow: 'hidden' }}>
          <Foto src={principal} borde={borde} />
        </div>
        <div
          style={{
            height: ALTO_MINIATURAS,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: SEPARACION_FOTOS,
          }}
        >
          {[0, 1].map((i) => (
            <div key={i} style={{ overflow: 'hidden' }}>
              <Foto src={chicas[i]} borde={borde} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...bloque, height: 28, margin: `0 ${MARGEN_FOTOS}px` }}>
        <div style={{ height: 4, background: tinta }} />
      </div>

      <div
        style={{
          ...bloque,
          height: 170,
          padding: `0 ${MARGEN_TEXTO}px`,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <TextoAjustado
            texto={d.precio}
            tamanoMax={92}
            tamanoMin={36}
            altoMax={100}
            style={{
              fontFamily: FAMILIA_SANS,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              color: acentoTexto,
            }}
          />
          {d.nota && (
            <div style={{ ...unaLinea, height: 36, lineHeight: '36px', fontSize: 28 }}>{d.nota}</div>
          )}
        </div>

        <div style={{ margin: '0 28px' }}>{verticalFina}</div>

        <div
          style={{
            flexShrink: 0,
            width: 360,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'right',
          }}
        >
          {d.agente && (
            <div
              style={{
                ...unaLinea,
                height: 34,
                lineHeight: '34px',
                textTransform: 'uppercase',
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              {d.agente}
            </div>
          )}
          {d.firma && (
            <div style={{ ...unaLinea, height: 30, lineHeight: '30px', fontSize: 24 }}>{d.firma}</div>
          )}
        </div>
      </div>
    </div>
  )
}
