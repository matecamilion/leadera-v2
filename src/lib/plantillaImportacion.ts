/**
 * La plantilla .xlsx que se descarga desde "Importar leads".
 *
 * Mismos criterios que `exportarExcel`: `exceljs` por import dinámico (pesa y
 * casi nadie lo necesita) y el libro armado aparte de la descarga para poder
 * inspeccionarlo sin navegador.
 */

/** Los encabezados que `sugerirMapeo` reconoce solos. */
export const ENCABEZADOS_PLANTILLA = [
  'Nombre',
  'Apellido',
  'Teléfono',
  'Email',
  'Estado',
  'Fecha de ingreso',
  'Descripción inicial',
]

/**
 * Datos inventados y a propósito poco creíbles: si la fila se importa sin
 * borrarla, que se note en la lista.
 */
const FILA_DE_EJEMPLO = [
  'EJEMPLO',
  'Borrar esta fila',
  '000 000-0000',
  'ejemplo@ejemplo.invalid',
  'Tibio',
  '01/01/2026',
  'Fila de ejemplo: borrala antes de importar.',
]

/** Paleta en ARGB, la misma del Excel de exportación. */
const COLOR = { marca: 'FF0F6E5C', blanco: 'FFFFFFFF' }

export function nombreArchivoPlantilla(): string {
  return 'plantilla-importar-leads-leadera.xlsx'
}

export async function construirLibroPlantilla() {
  const ExcelJS = await import('exceljs')

  const libro = new ExcelJS.Workbook()
  libro.creator = 'LeadEra'
  libro.created = new Date()

  const hoja = libro.addWorksheet('Leads', { views: [{ state: 'frozen', ySplit: 1 }] })

  const encabezado = hoja.addRow(ENCABEZADOS_PLANTILLA)
  encabezado.height = 24
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.marca } }
    celda.font = { bold: true, color: { argb: COLOR.blanco } }
    celda.alignment = { vertical: 'middle' }
  })

  // Todo texto, la fecha también: así Excel no la convierte ni la reordena.
  hoja.addRow(FILA_DE_EJEMPLO)

  ENCABEZADOS_PLANTILLA.forEach((titulo, i) => {
    const ancho = Math.max(titulo.length, FILA_DE_EJEMPLO[i].length) + 2
    hoja.getColumn(i + 1).width = Math.min(ancho, 45)
  })
  // El teléfono como texto: un número pierde el 0 inicial y los guiones.
  hoja.getColumn(3).numFmt = '@'

  return libro
}

/** Arma el libro y dispara la descarga en el navegador. */
export async function descargarPlantillaImportacion(): Promise<void> {
  const libro = await construirLibroPlantilla()
  const buffer = await libro.xlsx.writeBuffer()

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const ancla = document.createElement('a')
  ancla.href = url
  ancla.download = nombreArchivoPlantilla()
  document.body.appendChild(ancla)
  ancla.click()
  ancla.remove()
  URL.revokeObjectURL(url)
}
