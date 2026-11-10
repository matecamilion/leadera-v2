import type { ReactNode } from 'react'

interface EncabezadoPaginaProps {
  /** El `<h1>`. Acepta nodos: Mi día resalta el número de tareas dentro del título. */
  titulo: ReactNode
  /** Rótulo chico en mayúsculas sobre el título. */
  eyebrow?: string
  /** Una línea de contexto debajo del título. */
  descripcion?: ReactNode
  /** "N resultados · filtro": lo que dice cuánto se está viendo. Va debajo de la descripción. */
  contador?: ReactNode
  /**
   * Las acciones de la pantalla. Se montan tal cual, a la derecha, y pasan debajo
   * del título si no entran. Cada pantalla trae su propio contenedor de acciones.
   */
  acciones?: ReactNode
}

/**
 * Encabezado de página: eyebrow, título, descripción, contador y acciones.
 *
 * El título usa la escala del tema: `text-pagina` en pantallas chicas y
 * `text-display` desde `md`. Envuelve y se balancea, así que en 375px un título
 * largo baja de renglón en vez de empujar el ancho.
 */
export function EncabezadoPagina({
  titulo,
  eyebrow,
  descripcion,
  contador,
  acciones,
}: EncabezadoPaginaProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
      <div className="min-w-0 max-w-full">
        {eyebrow && (
          <p className="mb-1 text-meta font-bold tracking-wider text-primary uppercase">{eyebrow}</p>
        )}
        <h1 className="m-0 text-pagina font-bold text-balance break-words text-ink md:text-display">
          {titulo}
        </h1>
        {descripcion && <p className="m-0 mt-1 text-cuerpo text-ink-3">{descripcion}</p>}
        {contador && <p className="m-0 mt-1 text-cuerpo text-ink-3">{contador}</p>}
      </div>

      {acciones}
    </header>
  )
}
