import { Editorial } from './plantillas/Editorial'
import type { PlantillaImagen } from './tipos'

/** Para sumar una plantilla: un archivo en `plantillas/` y una línea acá. */
export const PLANTILLAS: PlantillaImagen[] = [
  { id: 'editorial', nombre: 'Editorial', fotos: 5, Componente: Editorial },
]
