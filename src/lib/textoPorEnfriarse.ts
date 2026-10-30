/** Texto de "hace cuánto", sin caer en plurales raros. */
export function textoDiasSinContacto(dias: number): string {
  return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`
}

/** Nombre completo sin el "null" de un apellido ausente. */
export function nombreDePorEnfriarse(lead: { nombre: string; apellido: string | null }): string {
  return `${lead.nombre} ${lead.apellido ?? ''}`.trim()
}
