/**
 * Pantalla de sección todavía sin construir.
 * Se reemplaza por la UI real de cada módulo a partir de Fase 4.
 */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Próximamente</p>
    </section>
  )
}
