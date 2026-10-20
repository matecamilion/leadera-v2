import type { CSSProperties } from 'react'
import { ALTO, ANCHO, FAMILIA_SANS, FAMILIA_SERIF } from '../constantes'
import { Foto } from '../Foto'
import { IconoDato } from '../iconos'
import { TextoAjustado } from '../TextoAjustado'
import { bordeDeFoto } from '../paletas'
import type { DatosImagen } from '../tipos'

const MARGEN_TEXTO = 56
const MARGEN_FOTOS = 20

/**
 * Alto fijo de la foto principal: no cambia con lo que se escriba. Los demás
 * bloques también son de alto fijo, así que los 20 px que sobran de los 1350
 * (ver la suma en `Editorial`) quedan como aire entre ellos.
 */
const ALTO_FOTO_PRINCIPAL = 500

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
 * Editorial: crema y un acento fino, título serif centrado.
 *
 * Presupuesto vertical (px): encabezado 86 + bloque superior 216 (zona 50,
 * título 110, dirección 56) + foto 500 + datos 92 + miniaturas 200 + precio 100
 * + bloque inferior 112 (nota 62, pie 50) + margen 24 = 1330.
 */
export function Editorial({ d }: { d: DatosImagen }) {
  const { fondo, tinta, acento, acentoTexto } = d.paleta
  const [principal, ...chicas] = d.fotos
  const borde = bordeDeFoto(d.paleta)

  const linea = <div style={{ flex: 1, height: 4, background: acento }} />

  return (
    <div
      style={{
        width: ANCHO,
        height: ALTO,
        position: 'relative',
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
      {/* Va en los 30 px de aire que tiene el encabezado arriba. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: acento }} />

      <div
        style={{
          ...bloque,
          height: 86,
          padding: `30px ${MARGEN_TEXTO}px 0`,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
        }}
      >
        {d.encabezado && (
          <div style={{ ...unaLinea, maxWidth: 520, fontSize: 30, fontWeight: 800 }}>
            {d.encabezado}
          </div>
        )}
        {linea}
        <div
          style={{
            flexShrink: 0,
            fontFamily: FAMILIA_SERIF,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: 6,
            color: acentoTexto,
          }}
        >
          {d.etiqueta}
        </div>
      </div>

      <div style={{ ...bloque, height: 216, padding: `0 ${MARGEN_TEXTO}px` }}>
        {d.zona && (
          <div
            style={{
              ...unaLinea,
              height: 50,
              lineHeight: '50px',
              textAlign: 'center',
              textTransform: 'uppercase',
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: 9,
              color: acentoTexto,
            }}
          >
            {d.zona}
          </div>
        )}

        <TextoAjustado
          texto={d.titulo}
          tamanoMax={100}
          tamanoMin={36}
          altoMax={110}
          style={{ fontFamily: FAMILIA_SERIF, fontWeight: 700 }}
        />

        {d.direccion && (
          <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 28 }}>
            {linea}
            <div
              style={{
                ...unaLinea,
                minWidth: 0,
                maxWidth: 700,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 2,
              }}
            >
              {d.direccion}
            </div>
            {linea}
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          height: ALTO_FOTO_PRINCIPAL,
          margin: `0 ${MARGEN_FOTOS}px`,
          overflow: 'hidden',
        }}
      >
        <Foto src={principal} borde={borde} />
      </div>

      <div
        style={{
          ...bloque,
          height: 92,
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
              height: 88,
              boxSizing: 'border-box',
              padding: '0 16px',
              borderLeft: i > 0 ? `3px solid ${acento}` : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {dato.icono !== 'ninguno' && (
              <div style={{ color: acentoTexto }}>
                <IconoDato clave={dato.icono} tamano={28} />
              </div>
            )}
            <div
              style={{
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1.15,
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
          flexShrink: 0,
          height: 200,
          margin: `0 ${MARGEN_FOTOS}px`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          columnGap: 8,
          overflow: 'hidden',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ overflow: 'hidden' }}>
            <Foto src={chicas[i]} borde={borde} />
          </div>
        ))}
      </div>

      <div
        style={{
          ...bloque,
          height: 100,
          padding: `0 ${MARGEN_TEXTO}px`,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 28,
        }}
      >
        {linea}
        <div
          style={{
            flexShrink: 0,
            fontFamily: FAMILIA_SERIF,
            fontSize: 64,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: acentoTexto,
          }}
        >
          {d.precio}
        </div>
        {linea}
      </div>

      <div style={{ ...bloque, height: 112, padding: `0 ${MARGEN_TEXTO}px` }}>
        {d.nota && (
          <div style={{ height: 62, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
              style={{
                ...unaLinea,
                boxSizing: 'border-box',
                maxWidth: '100%',
                padding: '8px 36px',
                border: `3px solid ${acento}`,
                color: acentoTexto,
                textTransform: 'uppercase',
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 4,
              }}
            >
              {d.nota}
            </div>
          </div>
        )}

        {(d.agente || d.firma) && (
          <div
            style={{
              ...unaLinea,
              height: 50,
              lineHeight: '50px',
              textAlign: 'center',
              textTransform: 'uppercase',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
            }}
          >
            {[d.agente, d.firma].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
