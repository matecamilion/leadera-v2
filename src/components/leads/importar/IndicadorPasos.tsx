const PASOS = ['Archivo', 'Columnas', 'Revisar', 'Resultado'] as const

interface IndicadorPasosProps {
  /** 1 a 4. Los pasos posteriores al actual quedan deshabilitados. */
  actual: 1 | 2 | 3 | 4
  /** Hasta qué paso está habilitado (los siguientes se ven apagados). */
  habilitados?: number
}

/**
 * Los cuatro pasos de la importación. Solo informa: no se navega desde acá.
 *
 * `@container`: la fila mide su contenedor y no la ventana. Angosta, solo el
 * paso actual muestra su nombre y el resto queda en el número.
 */
export function IndicadorPasos({ actual, habilitados = 2 }: IndicadorPasosProps) {
  return (
    <nav aria-label="Pasos de la importación" className="@container mb-6">
      <ol className="m-0 flex list-none items-center gap-2 p-0">
        {PASOS.map((nombre, i) => {
          const numero = i + 1
          const esActual = numero === actual
          const deshabilitado = numero > habilitados
          const hecho = numero < actual

          return (
            <li
              key={nombre}
              aria-current={esActual ? 'step' : undefined}
              aria-disabled={deshabilitado || undefined}
              className={`flex min-w-0 items-center gap-2 ${i < PASOS.length - 1 ? '@[32rem]:flex-1' : ''}`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.8rem] font-bold tabular-nums ${
                  esActual
                    ? 'bg-primary text-primary-contrast'
                    : hecho
                      ? 'bg-brand-soft text-primary'
                      : 'border border-border bg-surface text-ink-3'
                } ${deshabilitado ? 'opacity-50' : ''}`}
              >
                {numero}
              </span>
              <span
                className={`truncate text-[0.85rem] font-semibold ${
                  esActual ? 'inline text-ink' : 'hidden @[32rem]:inline'
                } ${deshabilitado ? 'text-ink-4' : esActual ? '' : 'text-ink-2'}`}
              >
                {nombre}
              </span>
              {i < PASOS.length - 1 && (
                <span aria-hidden className="hidden h-px flex-1 bg-border @[32rem]:block" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
