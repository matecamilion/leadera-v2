import type { ComponentType } from 'react'

export type ClavePaleta = 'dorado' | 'terracota' | 'negro' | 'verde'

export interface PaletaImagen {
  clave: ClavePaleta
  nombre: string
  fondo: string
  tinta: string
  acento: string
  /** Color del texto cuando va sobre un bloque de `acento`. */
  sobreAcento: string
}

/**
 * Todo lo que dibuja una plantilla. Son datos ya resueltos: las plantillas no
 * saben de propiedades ni de perfiles, sólo de esto. Un texto vacío significa
 * "no se dibuja" y la zona correspondiente tiene que colapsar.
 */
export interface DatosImagen {
  /** Las fotos elegidas, en orden: la 1 es la principal. */
  fotos: string[]
  titulo: string
  /** Hasta 4 datos cortos, ya sin los vacíos. */
  datos: string[]
  nota: string
  encabezado: string
  etiqueta: string
  zona: string
  /** Vacía si el interruptor de dirección está apagado. */
  direccion: string
  precio: string
  agente: string
  firma: string
  paleta: PaletaImagen
}

export interface PlantillaImagen {
  id: string
  nombre: string
  /** Cuántas fotos necesita. */
  fotos: number
  /** Con qué paleta arranca, mientras el agente no haya elegido una a mano. */
  paletaInicial: ClavePaleta
  Componente: ComponentType<{ d: DatosImagen }>
}
