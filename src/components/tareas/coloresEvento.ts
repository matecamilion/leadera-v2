import type { EventoCalendario } from '../../hooks/useTareas'

/**
 * Colores de cada tipo de evento del calendario, compartidos por el mes y la grilla
 * horaria. Son tokens del proyecto: el tema oscuro los redefine y se heredan solos.
 */

/**
 * Punto de color por tipo. Verde = trabajo propio, azul = lead, ámbar = visita
 * a una propiedad, siguiendo la paleta que ya usa el resto de la app.
 */
export const PUNTO: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'bg-primary',
  SEGUIMIENTO: 'bg-frio',
  VISITA: 'bg-tibio',
}

export const CHIP: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'bg-brand-soft text-primary-dark',
  SEGUIMIENTO: 'bg-cool-soft text-frio',
  // El ámbar de `--color-tibio` sobre su propio soft queda flojo de contraste;
  // la tinta oscura del badge tibio es la que el proyecto ya usa para eso.
  VISITA: 'bg-warm-soft text-badge-tibio-ink',
}
