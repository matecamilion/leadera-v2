import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { etiquetaTipo, formatearPrecio, type TipoPropiedad } from '../../lib/api/propiedades'

/**
 * Los ÚNICOS campos que entran a la ficha.
 *
 * Esto no es una comodidad: es la regla de negocio hecha tipo. La ficha se
 * comparte con compradores y con colegas de otras inmobiliarias, así que no
 * puede exponer a quién contactar directo. Al pedir este objeto y no la
 * `PropiedadDetalle` completa, el compilador rechaza que alguien pase
 * `lead_propietario`, `agente_id` o `inmobiliaria_id` sin querer.
 *
 * Si mañana hace falta sumar un dato, que sea uno de la propiedad. Nombres,
 * teléfonos y mails no van acá.
 */
export interface DatosFicha {
  direccion: string
  zona: string | null
  tipo: TipoPropiedad
  precio: number | null
  moneda: string
  ambientes: number | null
  metros_cuadrados: number | null
  descripcion: string | null
  fotos_urls: string[]
}

/** Cuántas fotos van arriba, en el bloque destacado. */
const FOTOS_DESTACADAS = 3

// Los tokens del sistema, en hexa: el PDF no lee variables CSS.
const C = {
  primary: '#0f6e5c',
  primaryDark: '#0b5246',
  ink: '#1a1f24',
  ink2: '#334155',
  ink3: '#5a6779',
  ink4: '#9ca3af',
  borde: '#e3e6ea',
  superficie2: '#f3f4f6',
  marcaSuave: '#e3efeb',
  blanco: '#ffffff',
}

/**
 * Helvetica y no Inter: registrar Inter obligaría a descargar un .ttf en
 * tiempo de generación, con su CORS y su demora. Helvetica viene embebida en
 * el motor y es la sans estándar más parecida.
 */
const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    color: C.ink,
    backgroundColor: C.blanco,
  },

  barra: {
    backgroundColor: C.primary,
    paddingHorizontal: 36,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barraMarca: { color: C.blanco, fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  barraTipo: {
    color: C.blanco,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  cuerpo: { paddingHorizontal: 36 },

  // --- fotos destacadas ---
  heroFila: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  heroGrande: { flex: 2, height: 210, objectFit: 'cover', borderRadius: 4 },
  heroColumna: { flex: 1, gap: 6 },
  heroChica: { width: '100%', height: 102, objectFit: 'cover', borderRadius: 4 },
  heroUnica: { width: '100%', height: 240, objectFit: 'cover', borderRadius: 4 },
  heroMitad: { flex: 1, height: 200, objectFit: 'cover', borderRadius: 4 },

  sinFotos: {
    height: 130,
    marginBottom: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borde,
    backgroundColor: C.superficie2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sinFotosTexto: { fontSize: 9, color: C.ink4 },

  // --- encabezado ---
  direccion: { fontSize: 21, fontFamily: 'Helvetica-Bold', lineHeight: 1.2 },
  zona: { fontSize: 10, color: C.ink3, marginTop: 4 },

  precioCaja: {
    marginTop: 14,
    marginBottom: 18,
    backgroundColor: C.marcaSuave,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  precioEtiqueta: { fontSize: 7.5, letterSpacing: 1, color: C.primaryDark, fontFamily: 'Helvetica-Bold' },
  precio: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: C.primary, marginTop: 3 },

  // --- características ---
  grid: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  celda: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  celdaEtiqueta: { fontSize: 7, letterSpacing: 0.8, color: C.ink3, fontFamily: 'Helvetica-Bold' },
  celdaValor: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4 },

  // --- descripción ---
  seccionTitulo: {
    fontSize: 8,
    letterSpacing: 1,
    color: C.ink3,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  descripcion: { fontSize: 10, lineHeight: 1.55, color: C.ink2, marginBottom: 18 },

  // --- galería ---
  galeriaFila: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  galeriaFoto: { flex: 1, height: 96, objectFit: 'cover', borderRadius: 4 },
  galeriaHueco: { flex: 1 },

  pie: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: C.borde,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pieMarca: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.primary },
  pieTexto: { fontSize: 7.5, color: C.ink4 },
})

/** Parte un array en filas de N, para las grillas de fotos. */
function enFilas<T>(items: T[], porFila: number): T[][] {
  const filas: T[][] = []
  for (let i = 0; i < items.length; i += porFila) {
    filas.push(items.slice(i, i + porFila))
  }
  return filas
}

function Destacadas({ fotos }: { fotos: string[] }) {
  if (fotos.length === 0) {
    return (
      <View style={estilos.sinFotos}>
        <Text style={estilos.sinFotosTexto}>Sin fotos cargadas</Text>
      </View>
    )
  }

  if (fotos.length === 1) {
    return (
      <View style={estilos.heroFila}>
        <Image src={fotos[0]} style={estilos.heroUnica} />
      </View>
    )
  }

  if (fotos.length === 2) {
    return (
      <View style={estilos.heroFila}>
        <Image src={fotos[0]} style={estilos.heroMitad} />
        <Image src={fotos[1]} style={estilos.heroMitad} />
      </View>
    )
  }

  // Tres o más: una grande a la izquierda y dos apiladas a la derecha.
  return (
    <View style={estilos.heroFila}>
      <Image src={fotos[0]} style={estilos.heroGrande} />
      <View style={estilos.heroColumna}>
        <Image src={fotos[1]} style={estilos.heroChica} />
        <Image src={fotos[2]} style={estilos.heroChica} />
      </View>
    </View>
  )
}

export function FichaPropiedadPDF({ propiedad }: { propiedad: DatosFicha }) {
  const fotos = propiedad.fotos_urls ?? []
  const destacadas = fotos.slice(0, FOTOS_DESTACADAS)
  const resto = fotos.slice(FOTOS_DESTACADAS)

  const generada = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Document
      title={`Ficha - ${propiedad.direccion}`}
      author="LeadEra"
      subject="Ficha de propiedad"
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.barra} fixed>
          <Text style={estilos.barraMarca}>LeadEra</Text>
          <Text style={estilos.barraTipo}>
            {etiquetaTipo(propiedad.tipo).toUpperCase()}
          </Text>
        </View>

        <View style={estilos.cuerpo}>
          <View style={{ marginTop: 18 }}>
            <Destacadas fotos={destacadas} />
          </View>

          <Text style={estilos.direccion}>{propiedad.direccion}</Text>
          {propiedad.zona && <Text style={estilos.zona}>{propiedad.zona}</Text>}

          <View style={estilos.precioCaja}>
            <Text style={estilos.precioEtiqueta}>PRECIO</Text>
            {/* Sin precio cargado va "Consultar" y no el guión de
                formatearPrecio: un guión suelto en cuerpo 24 se lee como un
                error, y esta ficha la recibe un comprador. */}
            <Text style={estilos.precio}>
              {propiedad.precio == null
                ? 'Consultar'
                : formatearPrecio(propiedad.precio, propiedad.moneda)}
            </Text>
          </View>

          <View style={estilos.grid}>
            <Celda etiqueta="TIPO" valor={etiquetaTipo(propiedad.tipo)} />
            <Celda
              etiqueta="AMBIENTES"
              valor={propiedad.ambientes != null ? String(propiedad.ambientes) : '—'}
            />
            <Celda
              etiqueta="SUPERFICIE"
              valor={
                propiedad.metros_cuadrados != null
                  ? `${propiedad.metros_cuadrados} m2`
                  : '—'
              }
            />
            <Celda etiqueta="ZONA" valor={propiedad.zona || '—'} />
          </View>

          {propiedad.descripcion && (
            <View>
              <Text style={estilos.seccionTitulo}>DESCRIPCION</Text>
              <Text style={estilos.descripcion}>{propiedad.descripcion}</Text>
            </View>
          )}

          {resto.length > 0 && (
            <View>
              <Text style={estilos.seccionTitulo}>MAS FOTOS</Text>
              {enFilas(resto, 3).map((fila, i) => (
                <View key={i} style={estilos.galeriaFila}>
                  {fila.map((url) => (
                    <Image key={url} src={url} style={estilos.galeriaFoto} />
                  ))}
                  {/* Rellena la última fila para que las fotos no se estiren. */}
                  {Array.from({ length: 3 - fila.length }, (_, j) => (
                    <View key={`hueco-${j}`} style={estilos.galeriaHueco} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sin teléfono, sin mail, sin nombre de nadie: a propósito. */}
        <View style={estilos.pie} fixed>
          <Text style={estilos.pieMarca}>LeadEra</Text>
          <Text style={estilos.pieTexto}>Ficha generada el {generada}</Text>
        </View>
      </Page>
    </Document>
  )
}

function Celda({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.celda}>
      <Text style={estilos.celdaEtiqueta}>{etiqueta}</Text>
      <Text style={estilos.celdaValor}>{valor}</Text>
    </View>
  )
}

export default FichaPropiedadPDF
