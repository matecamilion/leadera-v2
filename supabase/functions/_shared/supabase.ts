import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  type AltaCupo,
  evaluarCupo,
  type MiembroCupo,
  type ResultadoCupo,
  type RolAgente,
  type TopesCupo,
} from './cupo.ts'

/**
 * Cliente admin (service role). Bypassea RLS: se usa para crear usuarios,
 * inmobiliarias e invitaciones. NUNCA se expone al cliente.
 */
export function adminClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Cliente anon. Se usa para UNA sola cosa: canjear email+password por una
 * sesión después del alta (`signInWithPassword`). El service role key no puede
 * emitir sesiones de usuario, así que este paso requiere el anon key.
 * No se usa para leer ni escribir datos.
 */
export function anonClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL')
  const anonKey = requireEnv('SUPABASE_ANON_KEY')
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

/** Bearer token del header Authorization, o null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export type {
  AltaCupo,
  MotivoSinCupo,
  ResultadoCupo,
  RolAgente,
} from './cupo.ts'

export interface PerfilBasico {
  id: string
  rol: RolAgente
  inmobiliaria_id: string
}

/**
 * Cupo de la inmobiliaria: ¿entra un usuario más, con este rol?
 *
 * Lee la base y delega la decisión en `evaluarCupo` (`cupo.ts`), que tiene la
 * descripción de los tres topes y es la que se testea.
 *
 * El techo total sale de `planes_cupo` y NO de `inmobiliarias.limite_usuarios`
 * a propósito. Esa columna es una copia que escriben el webhook de Mercado Pago
 * y el cobro manual recién cuando entra un pago: entre dos pagos puede haber
 * quedado vieja, y además se la sube deliberadamente al máximo entre el tope
 * del plan y la gente ya cargada, para no dejar a ninguna cuenta con un límite
 * por debajo de su propio equipo. Leer el plan da el número contratado hoy, sin
 * ese ruido. La columna queda como fallback para las cuentas sin plan, que es
 * exactamente el comportamiento que había antes de los topes por rol.
 *
 * El conteo SÓLO mira miembros activos: un miembro desactivado no ocupa lugar.
 * Desactivar no borra a nadie —`toggle-activo-miembro` banea en Auth y baja la
 * bandera, pero el profile y toda su cartera siguen ahí— y por eso volver a
 * activarlo vuelve a pedir lugar: `toggle-activo-miembro` llama a esta función
 * con el rol y el `asiste_a` del miembro antes de desbanearlo. Sin esa
 * validación, alternar activo/inactivo permitiría superar el plan.
 */
export async function hayCupo(
  admin: SupabaseClient,
  inmobiliariaId: string,
  alta?: AltaCupo,
): Promise<ResultadoCupo> {
  // Se traen las filas en vez de un `count` porque hacen falta los conteos por
  // rol y por `asiste_a`, que un count agregado no da. Un equipo entra de sobra
  // en una página: el plan más grande con tope son 15 personas.
  const [{ data: inmobiliaria, error: errInmo }, { data: perfiles, error: errPerfiles }] =
    await Promise.all([
      admin
        .from('inmobiliarias')
        .select('plan, limite_usuarios')
        .eq('id', inmobiliariaId)
        .single<{ plan: string | null; limite_usuarios: number | null }>(),
      admin
        .from('profiles')
        .select('rol, asiste_a, activo')
        .eq('inmobiliaria_id', inmobiliariaId),
    ])

  if (errInmo || !inmobiliaria) throw new Error('No se encontró la inmobiliaria')
  if (errPerfiles || !perfiles) {
    throw new Error('No se pudo contar los usuarios de la inmobiliaria')
  }

  const topes = await cupoDelPlan(admin, inmobiliaria.plan)

  return evaluarCupo(perfiles as MiembroCupo[], topes, inmobiliaria.limite_usuarios, alta)
}

/**
 * El mensaje que explica por qué no entró.
 *
 * Vive acá y no en cada función porque `crear-invitacion` y `signup` chequean
 * el mismo cupo y tienen que decir lo mismo; si el texto se duplicara, el día
 * que cambie un tope una de las dos quedaría mintiendo.
 *
 * Cambia la perspectiva, no el motivo: `crear-invitacion` le habla al dueño o
 * al agente de su propia inmobiliaria ("tu plan"), y `signup` le habla a un
 * invitado, que todavía no es de la casa ("la inmobiliaria"). Ninguno nombra el
 * plan: el número sale de `planes_cupo`, así que decir "Solo" o "Agencia Chica"
 * acá sería un segundo lugar donde mantener los nombres comerciales.
 */
export function mensajeSinCupo(
  cupo: ResultadoCupo,
  perspectiva: 'propia' | 'ajena',
): string {
  const propia = perspectiva === 'propia'
  const tope = cupo.tope ?? 0

  switch (cupo.motivo) {
    case 'TOPE_AGENTES':
      return propia
        ? `Tu plan admite hasta ${plural(tope, 'agente', 'agentes')}, contando al dueño.`
        : `El plan de la inmobiliaria admite hasta ${plural(tope, 'agente', 'agentes')}, contando al dueño.`

    case 'TOPE_ASISTENTES':
      return propia
        ? `Ese agente ya tiene ${plural(tope, 'asistente', 'asistentes')}, el máximo de tu plan.`
        : `Ese agente ya tiene ${plural(tope, 'asistente', 'asistentes')}, el máximo de su plan.`

    case 'SIN_AGENTE':
      return 'Un asistente tiene que estar asignado a un agente.'

    case 'TECHO_TOTAL':
    default:
      return propia
        ? `Alcanzaste el límite de usuarios de tu plan (${cupo.usados}/${cupo.limite})`
        : `La inmobiliaria alcanzó el límite de usuarios de su plan (${cupo.usados}/${cupo.limite})`
  }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Los tres topes del plan, o null si no se pueden saber.
 *
 * Null tapa dos casos que acá dan lo mismo —la inmobiliaria no tiene plan, o el
 * plan no tiene fila en `planes_cupo`— y los dos mandan a `hayCupo` al fallback
 * de `inmobiliarias.limite_usuarios`. Un error de lectura cae en la misma
 * bolsa: se registra y se sigue con el número viejo, que es preferible a
 * tirarle un 500 a quien está invitando.
 */
async function cupoDelPlan(
  admin: SupabaseClient,
  plan: string | null,
): Promise<TopesCupo | null> {
  if (!plan) return null

  const { data, error } = await admin
    .from('planes_cupo')
    .select('limite_usuarios, max_agentes, max_asistentes_por_agente')
    .eq('plan', plan)
    .maybeSingle<{
      limite_usuarios: number | null
      max_agentes: number | null
      max_asistentes_por_agente: number | null
    }>()

  if (error) {
    console.error(`hayCupo: no se pudo leer el cupo del plan ${plan}`, error)
    return null
  }
  if (!data) return null

  return {
    limiteUsuarios: data.limite_usuarios === null ? null : Number(data.limite_usuarios),
    maxAgentes: data.max_agentes === null ? null : Number(data.max_agentes),
    maxAsistentesPorAgente:
      data.max_asistentes_por_agente === null ? null : Number(data.max_asistentes_por_agente),
  }
}
