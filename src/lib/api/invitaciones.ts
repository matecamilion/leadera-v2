import { supabase } from '../supabase'
import { mensajeDeFuncion, type RolAgente } from './equipo'

export interface InvitacionCreada {
  token: string
  link: string
  expira_at: string
  rol: RolAgente
  asiste_a: string | null
}

/**
 * Genera un link de invitación.
 *
 * El rol y el `asiste_a` quedan grabados en la fila de `invitaciones`; el
 * signup los lee de ahí y nunca del input del cliente, así que un invitado no
 * puede darse a sí mismo un rol distinto al que le tocó.
 */
export async function crearInvitacion(
  rol: RolAgente,
  asisteA?: string | null,
): Promise<InvitacionCreada> {
  const { data, error } = await supabase.functions.invoke<InvitacionCreada>(
    'crear-invitacion',
    { body: { rol, asiste_a: asisteA ?? null } },
  )

  if (error) throw new Error(await mensajeDeFuncion(error, 'No se pudo crear la invitación.'))
  if (!data) throw new Error('La invitación no devolvió datos.')

  // El link lo arma la función con su APP_BASE_URL, que apunta a producción.
  // En desarrollo eso mandaría a otro dominio, así que se rearma con el origen
  // desde el que se está usando la app.
  return { ...data, link: `${window.location.origin}/signup?invite=${encodeURIComponent(data.token)}` }
}

export interface InvitacionPendiente {
  id: string
  rol: RolAgente
  expira_at: string
  created_at: string
  /** Nombre de quien la generó. */
  creadaPor: string
  /** Nombre del agente al que asistiría el invitado, si es ASISTENTE. */
  asisteA: string | null
}

interface FilaInvitacion {
  id: string
  rol: RolAgente
  expira_at: string
  created_at: string
  creado_por: string
  asiste_a: string | null
}

/**
 * Invitaciones que todavía sirven: sin usar y sin vencer.
 *
 * No se trae el `token`: quien mira esta lista no necesita el link de otro, y
 * mostrarlo dejaría el secreto de la invitación a la vista de todo el equipo.
 */
export async function listarInvitacionesPendientes(): Promise<InvitacionPendiente[]> {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('id, rol, expira_at, created_at, creado_por, asiste_a')
    .eq('usado', false)
    .gt('expira_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`No se pudieron cargar las invitaciones: ${error.message}`)

  const filas = (data ?? []) as FilaInvitacion[]
  if (filas.length === 0) return []

  // Un solo viaje para todos los nombres que hacen falta, sean creadores o
  // asistidos.
  const ids = [
    ...new Set(
      filas.flatMap((f) => [f.creado_por, f.asiste_a]).filter((id): id is string => !!id),
    ),
  ]

  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido')
    .in('id', ids)

  const nombres = new Map(
    (perfiles ?? []).map((p) => [p.id, `${p.nombre} ${p.apellido}`.trim()]),
  )

  return filas.map((f) => ({
    id: f.id,
    rol: f.rol,
    expira_at: f.expira_at,
    created_at: f.created_at,
    creadaPor: nombres.get(f.creado_por) ?? 'Alguien del equipo',
    asisteA: f.asiste_a ? (nombres.get(f.asiste_a) ?? 'Otro agente') : null,
  }))
}
