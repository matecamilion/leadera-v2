/**
 * Qué columna del archivo es qué dato del lead.
 *
 * Adivina por el texto del encabezado; el usuario corrige a mano en la UI. Una
 * columna nunca se asigna a dos campos, y un campo nunca toma dos columnas.
 *
 * Aparte del mapeo uno a uno hay `detalle`: las columnas que se anexan al texto
 * de la consulta ("Dirección: Colón 1234"). Ahí sí entran todas las columnas
 * que se quiera, pero una columna que ya es un campo no puede estar también en
 * el detalle.
 */

export const CAMPOS_DESTINO = [
  'nombre',
  'apellido',
  'nombreCompleto',
  'telefono',
  'email',
  'estado',
  'origen',
  'fechaIngreso',
  'respondidoEl',
  'descripcion',
] as const

export type CampoDestino = (typeof CAMPOS_DESTINO)[number]

/**
 * Campo -> índice de columna (un campo sin columna no aparece), más las
 * columnas que van al detalle. `detalle` ausente es lo mismo que vacío.
 */
export type MapeoColumnas = Partial<Record<CampoDestino, number>> & { detalle?: number[] }

export interface SugerenciaMapeo {
  mapeo: MapeoColumnas
  /** Índices de las columnas que no quedaron asignadas a ningún campo. */
  sinMapear: number[]
}

interface Sinonimos {
  /** El encabezado entero, normalizado, es exactamente uno de estos. */
  exactos: string[]
  /**
   * Frases que cuentan si aparecen completas dentro del encabezado
   * ("telefono particular", "tel celular"). Más flojo que `exactos`, por eso
   * va solo con palabras que no se prestan a confusión.
   */
  contiene: string[]
  /** Si el encabezado tiene alguna de estas palabras, no es este campo. */
  excluye?: string[]
}

/**
 * Orden = prioridad cuando dos campos reclaman la misma columna a igual
 * puntaje.
 *
 * "Apellido y nombre" se deja afuera a propósito: en una planilla argentina
 * suele venir con el apellido primero, y partirlo como "nombre apellido" lo
 * daría vuelta. Sin sugerencia, el usuario lo mapea y lo ve.
 */
const SINONIMOS: Record<CampoDestino, Sinonimos> = {
  nombreCompleto: {
    exactos: [
      'nombre y apellido',
      'nombre y apellidos',
      'nombre completo',
      'nombres y apellidos',
      'nombre apellido',
      'full name',
      'cliente',
      'contacto',
      'persona',
      'lead',
    ],
    contiene: ['nombre completo', 'nombre y apellido'],
  },
  nombre: {
    exactos: ['nombre', 'nombres', 'first name', 'name', 'primer nombre'],
    contiene: [],
  },
  apellido: {
    exactos: ['apellido', 'apellidos', 'last name'],
    contiene: [],
  },
  telefono: {
    exactos: [
      'tel',
      'telefono',
      'telefonos',
      'celular',
      'cel',
      'whatsapp',
      'wsp',
      'movil',
      'mobile',
      'phone',
      'nro de telefono',
    ],
    contiene: ['telefono', 'celular', 'whatsapp', 'movil', 'tel', 'cel', 'wsp'],
  },
  email: {
    exactos: ['mail', 'email', 'e mail', 'correo', 'correo electronico', 'direccion de email'],
    contiene: ['email', 'mail', 'correo'],
  },
  estado: {
    exactos: ['temperatura', 'estado', 'status'],
    contiene: ['temperatura'],
  },
  origen: {
    exactos: ['origen', 'fuente', 'canal', 'procedencia'],
    contiene: ['origen'],
  },
  fechaIngreso: {
    exactos: [
      'fecha',
      'fecha de ingreso',
      'fecha ingreso',
      'fecha de alta',
      'fecha de creacion',
      'alta',
      'fecha de carga',
      'ingreso',
    ],
    contiene: ['fecha de ingreso', 'fecha de alta', 'fecha de creacion', 'fecha de carga'],
    excluye: ['nacimiento', 'seguimiento', 'proximo', 'ultimo', 'vencimiento', 'baja'],
  },
  // Cuándo respondió el agente (otro sistema). "Tiempo de respuesta" es una
  // duración y no una fecha: no está acá a propósito.
  respondidoEl: {
    exactos: ['respondido el', 'fecha de respuesta', 'respondido'],
    contiene: ['respondido el', 'fecha de respuesta'],
  },
  descripcion: {
    exactos: [
      'notas',
      'nota',
      'comentarios',
      'comentario',
      'consulta',
      'observaciones',
      'observacion',
      'detalle',
      'descripcion',
      'mensaje',
    ],
    contiene: ['notas', 'comentarios', 'observaciones', 'descripcion'],
  },
}

/**
 * Encabezados (normalizados, exactos) que se preseleccionan para el detalle.
 * Lista corta y cerrada a propósito: nunca UTM, "cliente vinculado", "tiempo de
 * respuesta" ni "id lead", que son ruido de la exportación y no de la consulta.
 */
const DETALLE_EXACTOS = new Set([
  'id propiedad',
  'propiedad',
  'direccion',
  'barrio',
  'zona',
  'barrio zona',
  'tipo de propiedad',
  'moneda',
  'precio',
])

/** Minúsculas, sin tildes ni signos, con los espacios colapsados. */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PUNTAJE_EXACTO = 2
const PUNTAJE_CONTIENE = 1

function nombraNombreYApellido(palabras: Set<string>): boolean {
  const nombre = palabras.has('nombre') || palabras.has('nombres')
  const apellido = palabras.has('apellido') || palabras.has('apellidos')
  return nombre && apellido
}

function puntaje(normalizado: string, campo: CampoDestino): number {
  const { exactos, contiene, excluye } = SINONIMOS[campo]
  const palabras = new Set(normalizado.split(' '))
  const rodeado = ` ${normalizado} `

  if (excluye?.some((palabra) => palabras.has(palabra))) return 0

  // Un encabezado con nombre Y apellido es de una sola persona entera: nunca
  // puede ser solo el nombre ni solo el apellido ("Nombre y apellido" al revés,
  // "Apellido y nombre", queda sin sugerencia a propósito).
  if ((campo === 'nombre' || campo === 'apellido') && nombraNombreYApellido(palabras)) return 0
  if (exactos.includes(normalizado)) return PUNTAJE_EXACTO

  // La frase tiene que aparecer tal cual y completa: "apellido y nombre" no es
  // "nombre y apellido" aunque tenga las mismas palabras.
  const coincide = contiene.some((frase) => rodeado.includes(` ${frase} `))
  return coincide ? PUNTAJE_CONTIENE : 0
}

export function sugerirMapeo(encabezados: string[]): SugerenciaMapeo {
  interface Candidato {
    columna: number
    campo: CampoDestino
    puntaje: number
  }

  const candidatos: Candidato[] = []
  encabezados.forEach((encabezado, columna) => {
    const normalizado = normalizarEncabezado(encabezado)
    if (!normalizado) return
    for (const campo of CAMPOS_DESTINO) {
      const p = puntaje(normalizado, campo)
      if (p > 0) candidatos.push({ columna, campo, puntaje: p })
    }
  })

  // Lo más seguro primero; a igual puntaje, el campo de mayor prioridad y la
  // columna más a la izquierda (el teléfono principal antes que el "alternativo").
  candidatos.sort(
    (a, b) =>
      b.puntaje - a.puntaje ||
      CAMPOS_DESTINO.indexOf(a.campo) - CAMPOS_DESTINO.indexOf(b.campo) ||
      a.columna - b.columna,
  )

  const mapeo: MapeoColumnas = {}
  const columnasUsadas = new Set<number>()

  for (const { columna, campo } of candidatos) {
    if (campo in mapeo || columnasUsadas.has(columna)) continue
    mapeo[campo] = columna
    columnasUsadas.add(columna)
  }

  // Lo que ningún campo reclamó y es de la propiedad va al detalle.
  const detalle = encabezados
    .map((encabezado, columna) => ({ columna, normalizado: normalizarEncabezado(encabezado) }))
    .filter(({ columna, normalizado }) => !columnasUsadas.has(columna) && DETALLE_EXACTOS.has(normalizado))
    .map(({ columna }) => columna)
  if (detalle.length > 0) {
    mapeo.detalle = detalle
    for (const columna of detalle) columnasUsadas.add(columna)
  }

  const sinMapear = encabezados.map((_, i) => i).filter((i) => !columnasUsadas.has(i))
  return { mapeo, sinMapear }
}

/** Las columnas del detalle, sin repetidas y en el orden del archivo. */
export function columnasDetalle(mapeo: MapeoColumnas): number[] {
  return [...new Set(mapeo.detalle ?? [])].sort((a, b) => a - b)
}

/** Hace falta al menos una columna de la que sacar el nombre. */
export function mapeoTieneNombre(mapeo: MapeoColumnas): boolean {
  return mapeo.nombre !== undefined || mapeo.nombreCompleto !== undefined
}

/**
 * Asigna una columna a un campo respetando que no se repita: si ya la tenía
 * otro campo, se la saca. `undefined` deja el campo sin columna. Para la UI.
 */
export function asignarColumna(
  mapeo: MapeoColumnas,
  campo: CampoDestino,
  columna: number | undefined,
): MapeoColumnas {
  const nuevo: MapeoColumnas = {}
  for (const otro of CAMPOS_DESTINO) {
    const actual = mapeo[otro]
    if (otro === campo || actual === undefined) continue
    if (actual !== columna) nuevo[otro] = actual
  }
  if (columna !== undefined) nuevo[campo] = columna

  // Una columna que pasa a ser un campo deja de ser detalle.
  const detalle = columnasDetalle(mapeo).filter((c) => c !== columna)
  if (detalle.length > 0) nuevo.detalle = detalle
  return nuevo
}

/**
 * Suma o saca una columna del detalle. Al sumarla se la saca de cualquier campo
 * que la tuviera: una columna es un dato del lead o va al detalle, no las dos.
 */
export function alternarDetalle(mapeo: MapeoColumnas, columna: number, incluir: boolean): MapeoColumnas {
  const nuevo: MapeoColumnas = {}
  for (const campo of CAMPOS_DESTINO) {
    const actual = mapeo[campo]
    if (actual === undefined || (incluir && actual === columna)) continue
    nuevo[campo] = actual
  }

  const detalle = columnasDetalle(mapeo).filter((c) => c !== columna)
  if (incluir) detalle.push(columna)
  detalle.sort((a, b) => a - b)
  if (detalle.length > 0) nuevo.detalle = detalle
  return nuevo
}
