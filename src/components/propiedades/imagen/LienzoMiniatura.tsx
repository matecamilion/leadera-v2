import { memo } from 'react'
import { ALTO, ANCHO } from './constantes'
import type { DatosImagen, PlantillaImagen } from './tipos'

/** Ancho de la miniatura en pantalla; el alto sale de la proporción 4:5 de la pieza. */
export const ANCHO_MINIATURA = 144
const ESCALA = ANCHO_MINIATURA / ANCHO

/**
 * La plantilla real, de 1080×1350, achicada con transform. Está memoizada: sólo
 * se vuelve a dibujar si cambia `d` (o la plantilla), así que quien la use tiene
 * que pasarle un `d` estable. No se exporta ni lleva el ref de la descarga.
 * Es decorativa: `aria-hidden` e `inert` sacan su texto y sus fotos del foco y
 * del lector de pantalla.
 */
export const LienzoMiniatura = memo(function LienzoMiniatura({
  Componente,
  d,
}: {
  Componente: PlantillaImagen['Componente']
  d: DatosImagen
}) {
  return (
    <div
      aria-hidden
      inert
      style={{ width: ANCHO_MINIATURA, height: ALTO * ESCALA, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div style={{ width: ANCHO, height: ALTO, transform: `scale(${ESCALA})`, transformOrigin: 'top left' }}>
        <Componente d={d} />
      </div>
    </div>
  )
})
