import { etiquetaEstado, etiquetaOrigen } from './etiquetasLead'
import type { LeadExportable } from './api/leads'

/** Formato con el que Excel muestra las celdas de fecha. */
const FORMATO_FECHA = 'dd/mm/yyyy hh:mm'
/** Ancho que ocupa una fecha ya formateada, para calcular la columna. */
const ANCHO_FECHA = FORMATO_FECHA.length

/**
 * Paleta del archivo, en ARGB porque es lo que pide ExcelJS.
 *
 * Son los tokens del sistema pasados a hexa: el .xlsx no lee variables CSS,
 * así que si cambian en `index.css` hay que actualizarlos también acá.
 */
const COLOR = {
  /** --color-primary */
  marca: 'FF0F6E5C',
  blanco: 'FFFFFFFF',
  /** --color-surface-2, para las filas alternadas */
  bandaClara: 'FFF3F4F6',
  /** --color-border */
  borde: 'FFE3E6EA',
}

const ALTO_ENCABEZADO = 24

/**
 * Una columna del Excel: el encabezado que ve el usuario y cómo sacar el
 * valor de cada lead. Definirlas juntas evita que el orden de los headers y
 * el de los datos se desincronicen.
 */
interface Columna {
  header: string
  /** `null` deja la celda vacía. */
  valor: (lead: LeadExportable) => string | Date | null
  /** true = va como fecha real de Excel, no como texto. */
  esFecha?: boolean
}

/**
 * Las fechas van como `Date` y no como texto.
 *
 * Excel ordena el texto alfabéticamente, así que con "27/06" y "09/07" como
 * strings el 9 de julio quedaría antes que el 27 de junio. Como fecha real se
 * ordena y se filtra bien, y se sigue viendo dd/mm/aaaa por el formato de
 * celda. Los `timestamptz` de la base se parsean a hora local.
 */
function aFecha(iso: string | null): Date | null {
  if (!iso) return null
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return null

  // ExcelJS arma el número de serie con los componentes UTC del Date, y una
  // celda de Excel no tiene zona horaria: es hora de pared a secas. Sin este
  // corrimiento un lead de las 11:30 en Buenos Aires se exportaba como 14:30.
  // Se resta el offset para que la hora UTC coincida con la hora local; el
  // offset se calcula sobre cada fecha, así un horario de verano se respeta.
  return new Date(f.getTime() - f.getTimezoneOffset() * 60_000)
}

/**
 * Celda vacía y no un guión cuando falta el dato: en una planilla el guión es
 * texto y ensucia los filtros y los conteos de Excel.
 */
const COLUMNAS: Columna[] = [
  { header: 'Nombre', valor: (l) => l.nombre },
  { header: 'Apellido', valor: (l) => l.apellido },
  { header: 'Teléfono', valor: (l) => l.telefono },
  { header: 'Email', valor: (l) => l.email },
  { header: 'Estado', valor: (l) => etiquetaEstado(l.estado) },
  { header: 'Origen', valor: (l) => etiquetaOrigen(l.origen) },
  { header: 'Fecha de ingreso', valor: (l) => aFecha(l.fecha_ingreso), esFecha: true },
  {
    header: 'Primer contacto',
    valor: (l) => aFecha(l.fecha_primer_contacto_real),
    esFecha: true,
  },
  {
    header: 'Último contacto',
    valor: (l) => aFecha(l.fecha_ultimo_contacto_real),
    esFecha: true,
  },
  {
    header: 'Próximo seguimiento',
    valor: (l) => aFecha(l.fecha_proximo_seguimiento),
    esFecha: true,
  },
  { header: 'Descripción inicial', valor: (l) => l.descripcion_inicial },
]

/** Ancho máximo de una columna, en caracteres. */
const ANCHO_MAXIMO = 60
/** Un respiro sobre el contenido más largo, para que no quede pegado. */
const ANCHO_HOLGURA = 2

/** Nombre del archivo, con la fecha de hoy en formato aaaa-mm-dd. */
export function nombreArchivoLeads(hoy: Date = new Date()): string {
  const aaaa = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  return `leads-leadera-${aaaa}-${mm}-${dd}.xlsx`
}

/** Cuánto mide en pantalla lo que va en una celda. */
function anchoDe(valor: string | Date | null): number {
  if (valor == null) return 0
  return valor instanceof Date ? ANCHO_FECHA : valor.length
}

/** Borde fino del mismo gris que usa la app para separar filas. */
const BORDE_FINO = { style: 'thin' as const, color: { argb: COLOR.borde } }

/**
 * Arma el libro en memoria.
 *
 * Separado de la descarga para poder inspeccionar el resultado sin depender
 * del navegador.
 *
 * `exceljs` se importa acá adentro y no arriba del archivo: pesa cientos de kB
 * y la mayoría de las sesiones nunca exportan nada. Así queda en su propio
 * chunk y sólo se baja cuando alguien aprieta el botón.
 *
 * Se pasó de SheetJS a ExcelJS por los estilos: relleno, negrita, bordes y
 * panel congelado son de pago en SheetJS y acá vienen incluidos.
 */
export async function construirLibroLeads(leads: LeadExportable[]) {
  const ExcelJS = await import('exceljs')

  const libro = new ExcelJS.Workbook()
  libro.creator = 'LeadEra'
  libro.created = new Date()

  const hoja = libro.addWorksheet('Leads', {
    // El congelado de verdad: al scrollear, la fila 1 se queda fija.
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const filas = leads.map((lead) => COLUMNAS.map((c) => c.valor(lead)))

  const filaEncabezado = hoja.addRow(COLUMNAS.map((c) => c.header))
  filaEncabezado.height = ALTO_ENCABEZADO
  filaEncabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.marca } }
    celda.font = { bold: true, color: { argb: COLOR.blanco } }
    celda.alignment = { vertical: 'middle' }
    celda.border = {
      top: BORDE_FINO,
      left: BORDE_FINO,
      bottom: BORDE_FINO,
      right: BORDE_FINO,
    }
  })

  filas.forEach((valores, indice) => {
    const fila = hoja.addRow(valores)
    // Banding: las impares van con un gris muy claro para que la vista no se
    // pierda de renglón en una tabla ancha.
    const conBanda = indice % 2 === 1

    fila.eachCell({ includeEmpty: true }, (celda, numeroColumna) => {
      celda.border = {
        top: BORDE_FINO,
        left: BORDE_FINO,
        bottom: BORDE_FINO,
        right: BORDE_FINO,
      }
      if (conBanda) {
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.bandaClara },
        }
      }
      if (COLUMNAS[numeroColumna - 1]?.esFecha) {
        celda.numFmt = FORMATO_FECHA
      }
    })
  })

  // Ancho aproximado por columna: el contenido más largo, con tope para que
  // una descripción larga no empuje al resto fuera de la pantalla. Se asigna
  // columna por columna y no con `hoja.columns = [...]`, que se saltea el
  // ancho de la primera.
  COLUMNAS.forEach((columna, i) => {
    const masLargo = filas.reduce(
      (max, fila) => Math.max(max, anchoDe(fila[i])),
      columna.header.length,
    )
    hoja.getColumn(i + 1).width = Math.min(masLargo + ANCHO_HOLGURA, ANCHO_MAXIMO)
  })

  // Autofiltro sobre el rango con datos: deja ordenar y filtrar en Excel sin
  // tener que seleccionar nada a mano.
  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: filas.length + 1, column: COLUMNAS.length },
    }
  }

  return libro
}

/** Arma el libro y dispara la descarga en el navegador. */
export async function generarExcelLeads(leads: LeadExportable[]): Promise<void> {
  const libro = await construirLibroLeads(leads)
  const buffer = await libro.xlsx.writeBuffer()

  // ExcelJS no descarga solo, a diferencia de SheetJS: arma el archivo y lo
  // deja en memoria, así que la bajada la disparamos a mano.
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const ancla = document.createElement('a')
  ancla.href = url
  ancla.download = nombreArchivoLeads()
  document.body.appendChild(ancla)
  ancla.click()
  ancla.remove()
  URL.revokeObjectURL(url)
}
