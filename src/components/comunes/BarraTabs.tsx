export interface ItemTab<Id extends string> {
  id: Id
  label: string
  /**
   * Contador al lado del nombre. Opcional: en Perfil ninguna pestaña cuenta
   * nada, y un "(0)" al lado de "Mi cuenta" mentiría sobre lo que hay adentro.
   */
  n?: number
}

interface BarraTabsProps<Id extends string> {
  /** Para el lector de pantalla: "Secciones del lead", "Secciones del perfil". */
  etiqueta: string
  tabs: ItemTab<Id>[]
  activa: Id
  onCambiar: (id: Id) => void
}

/**
 * La fila de pestañas, compartida por la ficha de lead y el perfil.
 *
 * Vivía adentro de `TabsDetalleLead`. Se extrajo cuando Perfil pasó a tabs:
 * copiar las clases habría dejado dos barras que se ven iguales hoy y se
 * separan en el primer retoque.
 *
 * El estado vive afuera, en la pantalla: cada una sabe cuál es su pestaña
 * inicial y qué renderiza en cada caso. Ninguna de las dos lo guarda en la URL
 * —el estado es interno, como venía siendo la ficha de lead—, así que volver
 * atrás no devuelve a la pestaña anterior.
 */
export function BarraTabs<Id extends string>({
  etiqueta,
  tabs,
  activa,
  onCambiar,
}: BarraTabsProps<Id>) {
  return (
    // Scrollea de costado en pantallas angostas en vez de estirar la página:
    // las pestañas suman más que el ancho de un teléfono y, al ser items de un
    // flex, no encogen. Mismo recurso —y misma forma de esconder la barra— que
    // los chips de filtro del listado de leads.
    <div
      role="tablist"
      aria-label={etiqueta}
      className="mb-5 flex overflow-x-auto border-b-2 border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const activo = activa === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activo}
            onClick={() => onCambiar(tab.id)}
            className={[
              '-mb-0.5 shrink-0 border-b-2 px-4.5 py-2.5 text-[0.83rem] font-semibold',
              'transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
              activo
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {tab.n !== undefined && ` (${tab.n})`}
          </button>
        )
      })}
    </div>
  )
}
