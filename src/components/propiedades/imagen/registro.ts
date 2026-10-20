import { Editorial } from './plantillas/Editorial'
import { Impacto } from './plantillas/Impacto'
import { Moderno } from './plantillas/Moderno'
import type { PlantillaImagen } from './tipos'

/** Para sumar una plantilla: un archivo en `plantillas/` y una línea acá. */
export const PLANTILLAS: PlantillaImagen[] = [
  { id: 'editorial', nombre: 'Editorial', fotos: 5, paletaInicial: 'dorado', Componente: Editorial },
  { id: 'impacto', nombre: 'Impacto', fotos: 3, paletaInicial: 'terracota', Componente: Impacto },
  { id: 'moderno', nombre: 'Moderno', fotos: 3, paletaInicial: 'negro', Componente: Moderno },
]
