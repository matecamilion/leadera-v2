import type { CSSProperties } from 'react'
import { ALTO, ANCHO, FAMILIA_SANS, FAMILIA_SERIF } from '../constantes'
import { Foto } from '../Foto'
import { IconoDato } from '../iconos'
import { TextoAjustado } from '../TextoAjustado'
import type { DatosImagen } from '../tipos'

const MARGEN_TEXTO = 48
const MARGEN_FOTOS = 24
const SEPARACION_FOTOS = 8

/**
 * Altos fijos de las fotos: no cambian con lo que se escriba. Los demás bloques
 * también son de alto fijo, así que los 26 px que sobran de los 1350 (ver la
 * suma en `Impacto`) quedan como aire entre ellos.
 */
const ALTO_FOTO_PRINCIPAL = 460
const ALTO_MINIATURAS = 250

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
 * Impacto: título enorme en el acento y banda de pie llena.
 *
 * Presupuesto vertical (px): encabezado 90 + bloque del título 258 (título
 * 170, zona 52, dirección 36) + fotos 718 (principal 460, separación 8,
 * miniaturas 250) + datos 84 + banda 150 + margen 24 = 1324.
 */
export function Impacto({ d }: { d: DatosImagen }) {
  const { fondo, tinta, acento, acentoTexto, sobreAcento } = d.paleta
  const [principal, ...chicas] = d.fotos

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
          height: 90,
          padding: `28px ${MARGEN_TEXTO}px 0`,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <div
          style={{
            ...unaLinea,
            flex: 1,
            minWidth: 0,
            fontSize: 30,
            fontWeight: 800,
            color: acentoTexto,
          }}
        >
          {d.encabezado}
        </div>
        <div
          style={{
            flexShrink: 0,
            padding: '0 40px',
            height: 54,
            lineHeight: '54px',
            background: acento,
            color: sobreAcento,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {d.etiqueta}
        </div>
      </div>

      <div style={{ ...bloque, height: 258, padding: `0 ${MARGEN_TEXTO}px`, color: acentoTexto }}>
        <TextoAjustado
          texto={d.titulo}
          tamanoMax={150}
          tamanoMin={40}
          altoMax={170}
          style={{ fontFamily: FAMILIA_SERIF, fontWeight: 900 }}
        />

        {d.zona && (
          <div
            style={{
              ...unaLinea,
              height: 52,
              lineHeight: '52px',
              textAlign: 'center',
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 8,
            }}
          >
            {d.zona}
          </div>
        )}

        {d.direccion && (
          <div
            style={{
              ...unaLinea,
              height: 36,
              lineHeight: '36px',
              textAlign: 'center',
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 4,
            }}
          >
            {d.direccion}
          </div>
        )}
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
          <Foto src={principal} />
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
              <Foto src={chicas[i]} />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          ...bloque,
          height: 84,
          padding: `0 ${MARGEN_TEXTO}px`,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {d.datos.map((dato, i) => (
          <div
            key={`${i}-${dato.texto}`}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: 80,
              boxSizing: 'border-box',
              padding: '0 16px',
              borderLeft: i > 0 ? `2px solid ${acento}` : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {dato.icono !== 'ninguno' && (
              <div style={{ color: acentoTexto }}>
                <IconoDato clave={dato.icono} tamano={24} />
              </div>
            )}
            <div
              style={{
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1.1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              {dato.texto}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...bloque,
          height: 150,
          margin: `0 ${MARGEN_FOTOS}px`,
          padding: '0 36px',
          flexDirection: 'row',
          alignItems: 'center',
          background: acento,
          color: sobreAcento,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextoAjustado
            texto={d.precio}
            tamanoMax={84}
            tamanoMin={36}
            altoMax={100}
            style={{
              fontFamily: FAMILIA_SERIF,
              fontWeight: 700,
              textAlign: 'left',
              whiteSpace: 'nowrap',
            }}
          />
        </div>

        <div
          style={{ flexShrink: 0, width: 2, height: 96, margin: '0 32px', background: sobreAcento, opacity: 0.5 }}
        />

        <div
          style={{
            flexShrink: 0,
            width: 380,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {d.nota && (
            <div
              style={{
                ...unaLinea,
                boxSizing: 'border-box',
                height: 46,
                padding: '0 20px',
                lineHeight: '46px',
                textAlign: 'center',
                background: fondo,
                color: acentoTexto,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {d.nota}
            </div>
          )}
          {d.agente && (
            <div
              style={{
                ...unaLinea,
                height: 30,
                lineHeight: '30px',
                textTransform: 'uppercase',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
              }}
            >
              {d.agente}
            </div>
          )}
          {d.firma && (
            <div
              style={{
                ...unaLinea,
                height: 28,
                lineHeight: '28px',
                textTransform: 'uppercase',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: 3,
              }}
            >
              {d.firma}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
