import type { CSSProperties } from 'react'
import { ALTO, ANCHO, FAMILIA_SANS, FAMILIA_SERIF } from '../constantes'
import {
  ALTO_DATOS,
  ALTO_DIRECCION,
  ALTO_ENCABEZADO,
  ALTO_MINIATURAS,
  ALTO_NOTA,
  ALTO_PIE,
  ALTO_PRECIO,
  ALTO_SUBTITULO,
  MARGEN_INFERIOR,
  repartirAlto,
} from '../alturasEditorial'
import { Foto } from '../Foto'
import { IconoDato } from '../iconos'
import { TextoAjustado } from '../TextoAjustado'
import { bordeDeFoto } from '../paletas'
import { subtituloSinZona } from '../subtitulo'
import type { DatosImagen } from '../tipos'

const MARGEN_TEXTO = 56
const MARGEN_FOTOS = 20

const INTERLINEADO_TITULAR = 1.15
const TAMANO_TITULAR_MAX = 160

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
 * Editorial: crema y un acento fino. La zona es el titular, serif y grande; el
 * título que escribe el agente va debajo, en la sans, sin repetir la zona. Sin
 * zona, el titular es el título. El presupuesto vertical está en `repartirAlto`
 * (`alturasEditorial.ts`).
 */
export function Editorial({ d }: { d: DatosImagen }) {
  const { fondo, tinta, acento, acentoTexto } = d.paleta
  const [principal, ...chicas] = d.fotos
  const borde = bordeDeFoto(d.paleta)
  const titular = d.zona || d.titulo
  const subtitulo = d.zona ? subtituloSinZona(d.titulo, d.zona) : ''
  const { alturaInferior, altoTitular, altoFoto } = repartirAlto({
    subtitulo: subtitulo !== '',
    direccion: d.direccion !== '',
    nota: d.nota !== '',
    pie: d.agente !== '' || d.firma !== '',
  })

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
        paddingBottom: MARGEN_INFERIOR,
        background: fondo,
        color: tinta,
        fontFamily: FAMILIA_SANS,
        // Playfair trae los números old-style de fábrica (los ceros parecen "o"):
        // `lnum` los pasa a lining. Se hereda en precio, datos y dirección.
        fontVariantNumeric: 'lining-nums',
        overflow: 'hidden',
      }}
    >
      {/* Va en los 30 px de aire que tiene el encabezado arriba. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: acento }} />

      <div
        style={{
          ...bloque,
          height: ALTO_ENCABEZADO,
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

      <div
        style={{
          ...bloque,
          height: altoTitular + (subtitulo ? ALTO_SUBTITULO : 0) + (d.direccion ? ALTO_DIRECCION : 0),
          padding: `0 ${MARGEN_TEXTO}px`,
        }}
      >
        <TextoAjustado
          texto={titular}
          tamanoMax={Math.min(TAMANO_TITULAR_MAX, Math.floor(altoTitular / INTERLINEADO_TITULAR))}
          tamanoMin={48}
          altoMax={altoTitular}
          interlineado={INTERLINEADO_TITULAR}
          style={{ fontFamily: FAMILIA_SERIF, fontWeight: 700, letterSpacing: '-0.02em' }}
        />

        {subtitulo && (
          <div
            style={{
              ...unaLinea,
              height: ALTO_SUBTITULO,
              lineHeight: `${ALTO_SUBTITULO}px`,
              textAlign: 'center',
              fontSize: 44,
              fontWeight: 600,
            }}
          >
            {subtitulo}
          </div>
        )}

        {d.direccion && (
          <div style={{ height: ALTO_DIRECCION, display: 'flex', alignItems: 'center', gap: 28 }}>
            {linea}
            <div
              style={{
                ...unaLinea,
                minWidth: 0,
                maxWidth: 700,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 1,
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
          height: altoFoto,
          margin: `0 ${MARGEN_FOTOS}px`,
          overflow: 'hidden',
        }}
      >
        <Foto src={principal} borde={borde} />
      </div>

      <div
        style={{
          ...bloque,
          height: ALTO_DATOS,
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
          height: ALTO_MINIATURAS,
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
          height: ALTO_PRECIO,
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
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: acentoTexto,
          }}
        >
          {d.precio}
        </div>
        {linea}
      </div>

      {alturaInferior > 0 && (
        <div style={{ ...bloque, height: alturaInferior, padding: `0 ${MARGEN_TEXTO}px` }}>
          {d.nota && (
            <div style={{ height: ALTO_NOTA, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div
                style={{
                  ...unaLinea,
                  boxSizing: 'border-box',
                  maxWidth: '100%',
                  padding: '8px 36px',
                  border: `3px solid ${acento}`,
                  color: acentoTexto,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 1,
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
                height: ALTO_PIE,
                lineHeight: `${ALTO_PIE}px`,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {[d.agente, d.firma].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
