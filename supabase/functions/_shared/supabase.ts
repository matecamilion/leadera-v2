import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

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

export type RolAgente = 'DUENO' | 'AGENTE' | 'ASISTENTE'

export interface PerfilBasico {
  id: string
  rol: RolAgente
  inmobiliaria_id: string
}

/** Por qué no entra un usuario más. Ausente cuando sí entra. */
export type MotivoSinCupo =
  | 'TECHO_TOTAL'
  | 'TOPE_AGENTES'
  | 'TOPE_ASISTENTES'
  | 'SIN_AGENTE'

/**
 * El alta que se está por hacer.
 *
 * Sin esto no se puede chequear nada por rol, así que `hayCupo` cae al techo
 * total y nada más.
 */
export interface AltaCupo {
  rol: RolAgente
  /** A qué agente asiste. Obligatorio cuando `rol` es ASISTENTE. */
  asisteA?: string | null
}

export interface ResultadoCupo {
  ok: boolean
  /** Profiles que ya tiene la inmobiliaria, sin filtrar por rol ni por activo. */
  usados: number
  /** Techo total vigente. NULL = sin tope. */
  limite: number | null
  motivo?: MotivoSinCupo
  /** El tope concreto contra el que se chocó, para poder nombrarlo en el mensaje. */
  tope?: number
}

interface CupoDelPlan {
  limiteUsuarios: number | null
  maxAgentes: number | null
  maxAsistentesPorAgente: number | null
}

interface FilaProfileCupo {
  rol: RolAgente
  asiste_a: string | null
}

/**
 * Cupo de la inmobiliaria: ¿entra un usuario más, con este rol?
 *
 * Son tres topes, todos de `planes_cupo`, y cada uno se saltea si su valor es
 * NULL ("sin tope"):
 *   - `limite_usuarios`           → techo total de profiles del plan
 *   - `max_agentes`               → cuántos DUENO + AGENTE admite. El dueño
 *     cuenta como agente: en SOLO, `max_agentes = 1` es él y no entra ninguno más.
 *   - `max_asistentes_por_agente` → cuántos ASISTENTE puede tener CADA agente,
 *     contados por `asiste_a`. No es un total de asistentes de la inmobiliaria.
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
 * El conteo NO filtra por `activo`: un miembro desactivado sigue ocupando un
 * lugar del plan, y eso es a propósito, no un filtro que se olvidó. Desactivar
 * no borra a nadie —`toggle-activo-miembro` banea en Auth y baja la bandera,
 * pero el profile y toda su cartera siguen ahí— así que el lugar sigue tomado.
 * Si no contaran, una inmobiliaria podría desactivar y sumar gente sin techo,
 * reactivando a los viejos cuando le conviene, y el límite del plan no
 * limitaría nada. Para liberar el lugar hay que borrar al miembro, no
 * desactivarlo.
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
        .select('rol, asiste_a')
        .eq('inmobiliaria_id', inmobiliariaId),
    ])

  if (errInmo || !inmobiliaria) throw new Error('No se encontró la inmobiliaria')
  if (errPerfiles || !perfiles) {
    throw new Error('No se pudo contar los usuarios de la inmobiliaria')
  }

  const equipo = perfiles as FilaProfileCupo[]
  const usados = equipo.length

  const cupoPlan = await cupoDelPlan(admin, inmobiliaria.plan)

  // Sin plan, o con un plan que no tiene fila en `planes_cupo`: se cae al
  // comportamiento de antes, que sólo conoce un número total.
  if (!cupoPlan) {
    const limite = inmobiliaria.limite_usuarios
    if (limite === null) return { ok: true, usados, limite: null }
    if (usados < limite) return { ok: true, usados, limite }
    return { ok: false, usados, limite, motivo: 'TECHO_TOTAL', tope: limite }
  }

  const limite = cupoPlan.limiteUsuarios

  // Los topes por rol van ANTES del techo total, y el orden se nota: una cuenta
  // SOLO con el dueño y sus dos asistentes choca los dos a la vez (3 de 3
  // usuarios, y 2 de 2 asistentes del dueño). Decirle "ese agente ya tiene 2
  // asistentes" le explica qué pasó; decirle "3 de 3 usuarios" la deja
  // buscando cuál de los tres sobra. Gana el tope más específico.
  if (alta?.rol === 'AGENTE' && cupoPlan.maxAgentes !== null) {
    const agentes = equipo.filter((p) => p.rol === 'DUENO' || p.rol === 'AGENTE').length
    if (agentes >= cupoPlan.maxAgentes) {
      return { ok: false, usados, limite, motivo: 'TOPE_AGENTES', tope: cupoPlan.maxAgentes }
    }
  }

  if (alta?.rol === 'ASISTENTE') {
    const asisteA = alta.asisteA ?? null

    // Un asistente sin agente no es un problema de cupo sino de datos: no se
    // puede contar contra ningún tope, y dejarlo entrar rompería el conteo de
    // todos los demás. Se corta incluso en los planes sin tope.
    if (!asisteA) return { ok: false, usados, limite, motivo: 'SIN_AGENTE' }

    if (cupoPlan.maxAsistentesPorAgente !== null) {
      const asistentes = equipo.filter(
        (p) => p.rol === 'ASISTENTE' && p.asiste_a === asisteA,
      ).length
      if (asistentes >= cupoPlan.maxAsistentesPorAgente) {
        return {
          ok: false,
          usados,
          limite,
          motivo: 'TOPE_ASISTENTES',
          tope: cupoPlan.maxAsistentesPorAgente,
        }
      }
    }
  }

  if (limite !== null && usados >= limite) {
    return { ok: false, usados, limite, motivo: 'TECHO_TOTAL', tope: limite }
  }

  return { ok: true, usados, limite }
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
): Promise<CupoDelPlan | null> {
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
