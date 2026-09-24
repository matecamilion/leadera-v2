-- Cupo por rol.
--
-- Hasta acá el cupo era un solo número (`inmobiliarias.limite_usuarios`) que se
-- comparaba contra el total de profiles sin mirar el rol. La regla comercial
-- distingue agentes de asistentes, así que `planes_cupo` pasa a guardar los dos
-- topes que faltaban:
--
--   SOLO           → 1 agente  (el dueño) + hasta 2 asistentes por agente
--   AGENCIA_CHICA  → 5 agentes            + hasta 2 asistentes por agente
--   AGENCIA_GRANDE → sin tope
--
-- Esta migración sólo deja los datos listos y arregla la escritura del cupo.
-- Quien va a hacer cumplir los topes es `hayCupo` en las Edge Functions
-- (`crear-invitacion` y `signup`), no un trigger: el enforcement sigue donde
-- está hoy, con el cliente admin, y esta migración no lo toca.
--
-- El segundo cambio es el que protege a las cuentas vivas. Hoy
-- `admin_registrar_pago_manual` copia `planes_cupo.limite_usuarios` tal cual, y
-- como `planes_cupo.SOLO` vale 1, registrarle un pago a una cuenta SOLO con dos
-- usuarios cargados le deja un tope por debajo de la gente que ya tiene: nadie
-- pierde el acceso —`hayCupo` sólo corre al agregar— pero la cuenta queda
-- congelada sin que nadie se entere. Ahora el valor que se escribe nunca baja
-- de la cantidad de profiles que la inmobiliaria ya tiene.
--
-- No toca ninguna policy ni RLS existente. No toca `profiles`.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Los dos topes que faltaban
-- ---------------------------------------------------------------------------
-- NULL significa "sin tope", el mismo significado que ya tiene
-- `planes_cupo.limite_usuarios` y que `hayCupo` lee como "siempre hay lugar".
-- Por eso las columnas son nullable y sin default: AGENCIA_GRANDE las quiere
-- en NULL, y un default de 0 haría que un plan sin tope no dejara entrar a
-- nadie.
alter table public.planes_cupo
  add column if not exists max_agentes int,
  add column if not exists max_asistentes_por_agente int;

comment on column public.planes_cupo.max_agentes is
  'Máximo de profiles con rol DUENO o AGENTE. NULL = sin tope.';

comment on column public.planes_cupo.max_asistentes_por_agente is
  'Máximo de ASISTENTE que puede tener cada agente. NULL = sin tope.';

-- ---------------------------------------------------------------------------
-- 2. Valores por plan
-- ---------------------------------------------------------------------------
-- UPDATE y no INSERT: las tres filas ya existen. Si alguna faltara, este
-- UPDATE no hace nada y el plan queda sin topes, que es preferible a inventar
-- una fila de cupo que nadie revisó.
--
-- El dueño cuenta como agente: en SOLO, `max_agentes = 1` es él, y el plan no
-- admite ningún AGENTE además.
--
-- `limite_usuarios` es el techo total y sale de los otros dos: agentes × (1 +
-- asistentes por agente). SOLO da 1 × 3 = 3 y AGENCIA_CHICA 5 × 3 = 15. Es el
-- tercero de los chequeos que va a hacer `hayCupo`, y el que impide que una
-- cuenta ya excedida siga creciendo: los topes por rol se miden por agente, así
-- que sin un techo total una cuenta con un agente de más podría sumar dos
-- asistentes de más junto con él.
--
-- Estos tres valores de `limite_usuarios` YA ESTÁN APLICADOS en la base: se
-- cargaron a mano el 24/09/2026. Esta migración no los cambia, los versiona,
-- para que un entorno nuevo arranque igual que producción y el valor quede
-- explicado en el repo en vez de vivir sólo en la tabla.
update public.planes_cupo
   set limite_usuarios = 3,
       max_agentes = 1,
       max_asistentes_por_agente = 2
 where plan = 'SOLO';

update public.planes_cupo
   set limite_usuarios = 15,
       max_agentes = 5,
       max_asistentes_por_agente = 2
 where plan = 'AGENCIA_CHICA';

-- Explícito aunque las columnas nuevas ya nacen en NULL: deja escrito que el
-- plan no tiene tope a propósito, y no porque nadie lo cargó.
update public.planes_cupo
   set limite_usuarios = null,
       max_agentes = null,
       max_asistentes_por_agente = null
 where plan = 'AGENCIA_GRANDE';

-- ---------------------------------------------------------------------------
-- 3. Registrar un pago manual: el cupo que se escribe nunca baja de lo cargado
-- ---------------------------------------------------------------------------
-- Reemplaza la versión de la migración 20260923120000 (línea 136). Es la misma
-- función —misma firma, mismo SECURITY DEFINER, mismo `search_path`, mismo
-- retorno, mismas validaciones, mismo evento— con un único cambio: el cálculo
-- del cupo.
--
-- Tres casos, y los tres importan:
--   - `planes_cupo` tiene fila con número → se escribe
--     `greatest(tope del plan, profiles que ya tiene)`. El `greatest` es el
--     arreglo: sin él, un pago le baja el tope por debajo de su propia gente.
--   - `planes_cupo` tiene fila con NULL   → se escribe NULL ("sin tope"). No
--     pasa por `greatest`: NULL ya es el techo más alto que existe.
--   - `planes_cupo` no tiene fila         → el cupo se deja como estaba, en vez
--     de bajárselo a quien acaba de pagar.
--
-- `found` después del SELECT es lo que separa el segundo caso del tercero: los
-- dos dejan `v_limite_usuarios` en NULL, y sin `found` serían indistinguibles.
create or replace function public.admin_registrar_pago_manual(
  p_inmobiliaria_id uuid,
  p_plan public.plan_leadera,
  p_meses int,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo text,
  p_nota text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta            public.inmobiliarias%rowtype;
  v_anterior          timestamptz;
  v_nuevo_hasta       timestamptz;
  v_limite_usuarios   int;
  v_aplicar_cupo      boolean;
  v_usuarios          int;
  v_metodo_legible    text;
  v_detalle           text;
  v_zona              text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  if p_meses is null or p_meses < 1 or p_meses > 12 then
    raise exception 'Los meses tienen que estar entre 1 y 12.';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_metodo is null or p_metodo not in ('TRANSFERENCIA', 'EFECTIVO', 'OTRO') then
    raise exception 'El método de pago tiene que ser TRANSFERENCIA, EFECTIVO u OTRO.';
  end if;

  -- FOR UPDATE: dos registros simultáneos sobre la misma cuenta se
  -- serializan, así que el segundo extiende sobre el resultado del primero en
  -- vez de pisarlo.
  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  -- Una suscripción viva en Mercado Pago le va a seguir escribiendo el estado
  -- a esta cuenta por webhook. Cobrarle además por transferencia es cobrarle
  -- dos veces, así que se corta acá.
  if v_cuenta.metodo_cobro = 'MERCADO_PAGO'
     and v_cuenta.estado_suscripcion = 'ACTIVA'
     and v_cuenta.mp_preapproval_id is not null
     and v_cuenta.cancelacion_solicitada = false then
    raise exception 'La cuenta tiene una suscripción activa de Mercado Pago. Cancelala antes de registrar un pago manual.';
  end if;

  v_anterior := v_cuenta.acceso_pagado_hasta;

  -- `greatest(..., now())` para que un pago tardío no arranque en el pasado:
  -- si el acceso ya venció, los meses se cuentan desde hoy. Si todavía está
  -- vigente, se apilan sobre lo que quedaba y no se le regala nada.
  v_nuevo_hasta := greatest(coalesce(v_cuenta.acceso_pagado_hasta, now()), now())
                   + make_interval(months => p_meses);

  -- Cupo de usuarios: el tope del plan, pero nunca por debajo de la gente que
  -- la inmobiliaria ya tiene cargada. Ver el comentario de arriba.
  select limite_usuarios into v_limite_usuarios
  from public.planes_cupo
  where plan = p_plan;
  v_aplicar_cupo := found;

  if v_aplicar_cupo and v_limite_usuarios is not null then
    -- SECURITY DEFINER, así que este conteo no lo acota RLS: son todos los
    -- profiles de la inmobiliaria. No filtra por `activo` a propósito, igual
    -- que `hayCupo`: un miembro desactivado sigue ocupando su lugar.
    select count(*) into v_usuarios
    from public.profiles
    where inmobiliaria_id = p_inmobiliaria_id;

    v_limite_usuarios := greatest(v_limite_usuarios, v_usuarios);
  end if;

  update public.inmobiliarias
     set estado_suscripcion       = 'ACTIVA',
         metodo_cobro             = 'MANUAL',
         acceso_pagado_hasta      = v_nuevo_hasta,
         plan                     = p_plan,
         fecha_ultimo_pago_fallido = null,
         cancelacion_solicitada   = false,
         limite_usuarios          = case when v_aplicar_cupo then v_limite_usuarios
                                         else limite_usuarios end
   where id = p_inmobiliaria_id;

  v_metodo_legible := case p_metodo
                        when 'TRANSFERENCIA' then 'Transferencia'
                        when 'EFECTIVO'      then 'Efectivo'
                        else 'Otro'
                      end;

  v_detalle := v_metodo_legible
    || ' · ' || p_meses || (case when p_meses = 1 then ' mes' else ' meses' end)
    || ' · Plan ' || p_plan::text
    || ' · pagado el ' || to_char(p_fecha_pago, 'DD/MM/YYYY')
    || ' · activa hasta ' || to_char(v_nuevo_hasta at time zone v_zona, 'DD/MM/YYYY')
    || coalesce(' · Nota: ' || nullif(btrim(p_nota), ''), '');

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'pago_manual',
    p_monto,
    'ARS',
    v_detalle,
    jsonb_build_object(
      'meses', p_meses,
      'metodo', p_metodo,
      'fecha_pago', p_fecha_pago,
      'nota', nullif(btrim(p_nota), ''),
      'plan', p_plan::text,
      'acceso_hasta_anterior', v_anterior,
      'acceso_hasta_nuevo', v_nuevo_hasta,
      'registrado_por', auth.uid()
    )
  );

  return v_nuevo_hasta;
end;
$$;

revoke execute on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) from public, anon;
grant execute on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) to authenticated;

comment on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) is
  'Panel /admin: registra un pago por transferencia y extiende el acceso. Sólo superadmin (chequeo interno).';

-- ---------------------------------------------------------------------------
-- 4. Cómo quedó la tabla
-- ---------------------------------------------------------------------------
select plan, limite_usuarios, max_agentes, max_asistentes_por_agente
from public.planes_cupo
order by plan;

commit;
