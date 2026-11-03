import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { etiquetaTipo } from '../../lib/api/propiedades'
import type { DatosFicha } from './ficha/datos'
import { C, M, T } from './ficha/diseno'
import { SANS, SERIF } from './ficha/fuentes'
import {
  datosClave,
  fechaGenerada,
  filasGaleria,
  partirDescripcion,
  precioFicha,
  repartirDatos,
  repartirFotos,
} from './ficha/formato'

/** Dos columnas con aire entre medio, en proporción 4:3. */
const ANCHO_GALERIA = (M.anchoUtil - M.galeriaGap) / 2
const ALTO_GALERIA = Math.round((ANCHO_GALERIA * 3) / 4)
/** La última foto de una galería impar ocupa el ancho completo en 16:9. */
const ALTO_GALERIA_ANCHA = Math.round((M.anchoUtil * 9) / 16)

/** Ancho de cada foto de la tira, según cuántas sean. */
function anchoTira(cantidad: number): number {
  return (M.anchoUtil - M.galeriaGap * (cantidad - 1)) / cantidad
}

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: M.margen,
    paddingHorizontal: M.margen,
    // El pie fijo vive dentro del margen inferior.
    paddingBottom: M.margen + M.pieAlto,
    fontFamily: SANS,
    fontWeight: 400,
    color: C.ink,
    backgroundColor: C.blanco,
  },

  // --- foto principal ---
  // A sangre: los márgenes negativos cancelan el padding de la página.
  hero: {
    width: M.anchoPagina,
    height: M.heroAlto,
    marginTop: -M.margen,
    marginLeft: -M.margen,
    objectFit: 'cover',
    objectPosition: '50% 40%',
  },
  heroVacio: {
    width: M.anchoPagina,
    height: M.heroAlto,
    marginTop: -M.margen,
    marginLeft: -M.margen,
    backgroundColor: C.fondoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVacioTexto: { fontSize: T.subtitulo, color: C.ink3 },

  // --- encabezado ---
  zona: {
    marginTop: 18,
    fontSize: T.rotulo,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  direccion: { marginTop: 6, fontFamily: SERIF, fontWeight: 700, fontSize: T.direccion, lineHeight: 1.15 },
  tipo: { marginTop: 6, fontSize: T.subtitulo, color: C.ink3 },

  // --- precio ---
  precioBloque: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  precioMoneda: { fontSize: T.precioMoneda, fontWeight: 700, color: C.blanco, marginRight: 8 },
  precioCifra: { fontSize: T.precio, fontWeight: 700, color: C.blanco },
  precioConsultar: { fontSize: T.precioConsultar, fontWeight: 700, color: C.blanco },

  // --- datos clave ---
  datosFila: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.borde },
  datosCelda: { flex: 1, paddingVertical: 11, paddingLeft: 12, paddingRight: 6 },
  datosCeldaPrimera: { paddingLeft: 0 },
  datosCeldaConLinea: { borderLeftWidth: 1, borderLeftColor: C.borde },
  datosEtiqueta: { fontSize: T.rotuloChico, fontWeight: 600, letterSpacing: 1, color: C.ink3, textTransform: 'uppercase' },
  datosValor: { marginTop: 3, fontSize: T.dato, fontWeight: 700 },

  // --- secciones ---
  seccion: { marginTop: 16 },
  seccionLinea: { width: 28, height: 2, marginBottom: 7 },
  seccionTitulo: { fontSize: T.seccion, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' },
  descripcion: { marginTop: 8, fontSize: T.cuerpo, lineHeight: 1.5, color: C.ink2 },

  // --- tira de fotos (página 1) ---
  tira: { marginTop: 14, flexDirection: 'row' },
  tiraFoto: { height: M.tiraAlto, objectFit: 'cover' },

  // --- galería ---
  galeriaFila: { flexDirection: 'row', marginTop: M.galeriaGap },
  galeriaFoto: { width: ANCHO_GALERIA, height: ALTO_GALERIA, objectFit: 'cover' },
  galeriaFotoSegunda: { marginLeft: M.galeriaGap },
  galeriaFotoAncha: { width: M.anchoUtil, height: ALTO_GALERIA_ANCHA, objectFit: 'cover' },

  // --- pie ---
  pie: {
    position: 'absolute',
    bottom: M.margen - 8,
    left: M.margen,
    right: M.margen,
    borderTopWidth: 1,
    borderTopColor: C.borde,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pieInmobiliaria: { fontSize: T.pie, fontWeight: 600, color: C.ink2, maxWidth: 260 },
  pieDerecha: { marginLeft: 'auto', fontSize: T.pie, color: C.ink4 },
})

interface Props {
  propiedad: DatosFicha
  /** Fotos ya reducidas y validadas (URLs de datos). Máximo `M.maxFotos`. */
  fotos: string[]
  /** Color de acento ya ajustado para que el texto blanco se lea encima. */
  acento: string
}

function Titulo({ texto, acento }: { texto: string; acento: string }) {
  return (
    <View>
      <View style={[estilos.seccionLinea, { backgroundColor: acento }]} />
      <Text style={[estilos.seccionTitulo, { color: acento }]}>{texto}</Text>
    </View>
  )
}

export function FichaPropiedadPDF({ propiedad, fotos, acento }: Props) {
  const { portada: principal, tira, galeria } = repartirFotos(fotos)
  const precio = precioFicha(propiedad.precio, propiedad.moneda)
  const datos = datosClave(propiedad)
  const generada = fechaGenerada()
  const zona = propiedad.zona?.trim()
  const partes = propiedad.descripcion?.trim() ? partirDescripcion(propiedad.descripcion) : null
  const inmobiliaria = propiedad.inmobiliaria

  return (
    <Document
      title={`Ficha - ${propiedad.direccion}`}
      author={inmobiliaria ?? undefined}
      subject="Ficha de propiedad"
    >
      <Page size="A4" style={estilos.pagina}>
        {principal ? (
          <Image src={principal} style={estilos.hero} />
        ) : (
          <View style={estilos.heroVacio}>
            <Text style={estilos.heroVacioTexto}>Sin fotos cargadas</Text>
          </View>
        )}

        <View wrap={false}>
          {zona ? <Text style={[estilos.zona, { color: acento }]}>{zona}</Text> : null}
          <Text style={[estilos.direccion, zona ? {} : { marginTop: 18 }]}>{propiedad.direccion}</Text>
          <Text style={estilos.tipo}>{etiquetaTipo(propiedad.tipo)}</Text>

          <View style={[estilos.precioBloque, { backgroundColor: acento }]}>
            {precio ? (
              <>
                {precio.moneda ? <Text style={estilos.precioMoneda}>{precio.moneda}</Text> : null}
                <Text style={estilos.precioCifra}>{precio.cifra}</Text>
              </>
            ) : (
              <Text style={estilos.precioConsultar}>Consultar precio</Text>
            )}
          </View>
        </View>

        {datos.length > 0 && (
          <View style={{ marginTop: 14, borderBottomWidth: 1, borderBottomColor: C.borde }} wrap={false}>
            {repartirDatos(datos).map((fila, i) => (
              <View key={i} style={estilos.datosFila}>
                {fila.map((d, j) => (
                  <View
                    key={d.etiqueta}
                    style={[
                      estilos.datosCelda,
                      j === 0 ? estilos.datosCeldaPrimera : estilos.datosCeldaConLinea,
                    ]}
                  >
                    <Text style={estilos.datosEtiqueta}>{d.etiqueta}</Text>
                    <Text style={estilos.datosValor}>{d.valor}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {tira.length > 0 && (
          <View style={estilos.tira} wrap={false}>
            {tira.map((url, i) => (
              <Image
                key={i}
                src={url}
                style={[
                  estilos.tiraFoto,
                  { width: anchoTira(tira.length) },
                  i > 0 ? { marginLeft: M.galeriaGap } : {},
                ]}
              />
            ))}
          </View>
        )}

        {partes ? (
          <View style={estilos.seccion}>
            {/* Título y arranque en un bloque que no se parte: el título nunca queda solo. */}
            <View wrap={false}>
              <Titulo texto="Descripción" acento={acento} />
              <Text style={estilos.descripcion}>{partes.inicio}</Text>
            </View>
            {partes.resto ? (
              <Text style={[estilos.descripcion, { marginTop: 0 }]} orphans={2} widows={2}>
                {partes.resto}
              </Text>
            ) : null}
          </View>
        ) : null}

        {galeria.length > 0 && (
          <View style={estilos.seccion}>
            {filasGaleria(galeria).map((fila, i) => (
              // wrap={false}: una foto nunca queda partida entre páginas. El
              // título viaja con la primera fila para no quedar solo.
              <View key={i} wrap={false} style={i === 0 ? undefined : estilos.galeriaFila}>
                {i === 0 && <Titulo texto="Más fotos" acento={acento} />}
                <View style={i === 0 ? { flexDirection: 'row', marginTop: M.galeriaGap } : { flexDirection: 'row' }}>
                  {fila.length === 1 ? (
                    <Image src={fila[0]} style={estilos.galeriaFotoAncha} />
                  ) : (
                    fila.map((url, j) => (
                      <Image
                        key={j}
                        src={url}
                        style={[estilos.galeriaFoto, j === 1 ? estilos.galeriaFotoSegunda : {}]}
                      />
                    ))
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sin teléfono, sin mail, sin nombre de nadie: a propósito. */}
        <View style={estilos.pie} fixed>
          {inmobiliaria ? <Text style={estilos.pieInmobiliaria}>{inmobiliaria}</Text> : null}
          <Text
            style={estilos.pieDerecha}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}  ·  Generada el ${generada}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

export default FichaPropiedadPDF
