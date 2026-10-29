/**
 * Filas que se repiten dentro del mismo archivo, fusionadas en un solo lead.
 *
 * No mira la base: detecta que dos filas del archivo son la misma persona (mismo
 * teléfono normalizado o mismo email) y las junta. Gana la primera: sus datos
 * personales son los del lead, completados con el teléfono o el email de las
 * otras si le faltan; el detalle reúne las consultas de todas, ordenadas por
 * fecha; la fecha de ingreso es la más antigua; el origen sale de la consulta más
 * antigua que tenga origen y el estado de la más reciente que tenga estado.
 */
import {
  avisosDeDescripcion,
  componerDescripcion,
  ordenarPorFecha,
  type Consulta,
} from './descripcionConsultas'
import type { FilaNormalizada } from './normalizarFilas'

export interface DuplicadoEnArchivo {
  /** Número de fila (del archivo) a la que repite. */
  duplicaA: number
  por: 'TELEFONO' | 'EMAIL'
}

export type FilaConDuplicado = FilaNormalizada & {
  /** null si la fila es la primera de su persona. */
  duplicadoEnArchivo: DuplicadoEnArchivo | null
  /**
   * En la primera fila de una persona: cuántas filas se fusionaron en ella (sus
   * datos ya están dentro de esta). 0 en las demás.
   */
  consultasFusionadas: number
}

/**
 * Teléfono primero, como en `consulta-publica`. Las filas con errores
 * bloqueantes no participan: no se van a importar, así que no pueden "ganarle"
 * a una fila buena.
 *
 * Una fila fusionada registra sus datos a nombre de la primera: así una tercera
 * fila que solo comparte con ella el email o el teléfono también se fusiona. Si
 * no, quedaría como otro lead con un email que el primero ya tiene.
 */
export function marcarDuplicadosEnArchivo(filas: FilaNormalizada[]): FilaConDuplicado[] {
  const porTelefono = new Map<string, number>()
  const porEmail = new Map<string, number>()

  /** Índice de la primera fila de cada persona -> índices de las que se le fusionan. */
  const fusionadas = new Map<number, number[]>()
  const marcas = new Map<number, DuplicadoEnArchivo>()
  /** Lo que cada primera fila tiene (o gana) de teléfono y email. */
  const contacto = new Map<number, Pick<FilaNormalizada, 'telefono' | 'telefonoNorm' | 'telefonoDudoso' | 'email'>>()

  filas.forEach((fila, i) => {
    if (fila.errores.length > 0) return

    // Un teléfono dudoso no se compara: dos "iguales" pueden serlo por azar.
    const telefono = fila.telefonoNorm && !fila.telefonoDudoso ? fila.telefonoNorm : null

    let primera = telefono ? porTelefono.get(telefono) : undefined
    let por: DuplicadoEnArchivo['por'] = 'TELEFONO'
    if (primera === undefined && fila.email) {
      primera = porEmail.get(fila.email)
      por = 'EMAIL'
    }

    if (primera === undefined) {
      if (telefono) porTelefono.set(telefono, i)
      if (fila.email) porEmail.set(fila.email, i)
      contacto.set(i, {
        telefono: fila.telefono,
        telefonoNorm: fila.telefonoNorm,
        telefonoDudoso: fila.telefonoDudoso,
        email: fila.email,
      })
      return
    }

    marcas.set(i, { duplicaA: filas[primera].fila, por })
    fusionadas.set(primera, [...(fusionadas.get(primera) ?? []), i])

    // Sus datos pasan a ser de la primera, salvo los que ya son de otra persona.
    if (telefono && !porTelefono.has(telefono)) porTelefono.set(telefono, primera)
    if (fila.email && !porEmail.has(fila.email)) porEmail.set(fila.email, primera)

    const actual = contacto.get(primera)!
    if (!actual.telefono && fila.telefono && (!telefono || porTelefono.get(telefono) === primera)) {
      actual.telefono = fila.telefono
      actual.telefonoNorm = fila.telefonoNorm
      actual.telefonoDudoso = fila.telefonoDudoso
    }
    if (!actual.email && fila.email && porEmail.get(fila.email) === primera) actual.email = fila.email
  })

  return filas.map((fila, i) => {
    const marca = marcas.get(i)
    if (marca) return { ...fila, duplicadoEnArchivo: marca, consultasFusionadas: 0 }

    const otras = fusionadas.get(i)
    if (!otras) return { ...fila, duplicadoEnArchivo: null, consultasFusionadas: 0 }

    return { ...fusionar(fila, otras.map((j) => filas[j]), contacto.get(i)!), duplicadoEnArchivo: null, consultasFusionadas: otras.length }
  })
}

/**
 * El estado de la consulta más reciente que tenga estado. A igual fecha gana la
 * primera del archivo (`filas` viene en ese orden). Una fecha conocida pesa más
 * que una desconocida: sin fecha solo gana si ninguna fila con estado tiene una.
 */
function estadoMasReciente(filas: FilaNormalizada[]): FilaNormalizada['estado'] {
  const conEstado = filas.filter((f) => f.estado !== null)
  const conFecha = conEstado.filter((f) => f.fechaIngreso !== null)
  if (conFecha.length === 0) return conEstado[0]?.estado ?? null

  let mejor = conFecha[0]
  for (const f of conFecha) {
    if (f.fechaIngreso!.getTime() > mejor.fechaIngreso!.getTime()) mejor = f
  }
  return mejor.estado
}

/** La fecha más antigua (`Math.min`) o más reciente (`Math.max`) de las que hay; null si no hay ninguna. */
function extremo(fechas: (Date | null)[], elegir: typeof Math.min): Date | null {
  const tiempos = fechas.filter((f): f is Date => f !== null).map((f) => f.getTime())
  return tiempos.length > 0 ? new Date(elegir(...tiempos)) : null
}

/** La primera fila de una persona con los datos de las que se le fusionan. */
function fusionar(
  primera: FilaNormalizada,
  otras: FilaNormalizada[],
  contacto: Pick<FilaNormalizada, 'telefono' | 'telefonoNorm' | 'telefonoDudoso' | 'email'>,
): FilaNormalizada {
  const todas = [primera, ...otras]

  const consultas = todas.map((f) => f.consulta).filter((c): c is Consulta => c !== null)
  const compuesta = componerDescripcion(consultas)
  const avisosDescripcion = avisosDeDescripcion(compuesta)

  const fechas = todas.map((f) => f.fechaIngreso).filter((f): f is Date => f !== null)
  const masAntigua = fechas.length > 0 ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null

  const filasFusionadas = otras.map((f) => f.fila).join(', ')
  const avisos = [
    ...primera.avisos.filter((a) => !primera.avisosDescripcion.includes(a)),
    ...avisosDescripcion,
    `Se fusionaron ${otras.length} ${otras.length === 1 ? 'consulta repetida' : 'consultas repetidas'} de la misma persona (filas ${filasFusionadas}).`,
  ]

  return {
    ...primera,
    ...contacto,
    estado: estadoMasReciente(todas),
    origen: ordenarPorFecha(todas, (f) => f.fechaIngreso).find((f) => f.origen)?.origen ?? null,
    fechaIngreso: masAntigua,
    // El primer contacto es la respuesta más antigua y el último la más reciente;
    // sin ninguna respuesta no se manda nada.
    primerContacto: extremo(todas.map((f) => f.primerContacto), Math.min),
    ultimoContacto: extremo(todas.map((f) => f.ultimoContacto), Math.max),
    descripcion: compuesta.texto,
    avisosDescripcion,
    avisos,
  }
}
