-- Cobro manual por transferencia.
--
-- El cobro con tarjeta de Mercado Pago queda bloqueado temporalmente, así que
-- una cuenta puede pagar por fuera de la app. Eso rompe un supuesto del modelo
-- actual: hoy una cuenta ACTIVA sin cancelación pedida NO vence nunca por
-- fecha, porque quien la mantiene viva es el webhook de MP. Sin webhook no hay
-- nada que la venza, y una cuenta manual quedaría activa para siempre.
--
-- Lo que agrega esta migración:
--   1. `metodo_cobro` y `acceso_pagado_hasta` en `inmobiliarias`.
--   2. Dos reglas nuevas en `procesar_transiciones_suscripcion()`, el cron
--      diario, para que las cuentas manuales sí venzan por fecha.
--   3. `admin_registrar_pago_manual()`: el superadmin registra un pago y
--      extiende el acceso.
--   4. `admin_ajustar_vencimiento()`: corrección a mano de la fecha, con nota
--      obligatoria.
--   5. El precio nuevo del plan SOLO.
--
-- No toca ninguna policy ni RLS existente. Las dos funciones nuevas son
-- SECURITY DEFINER y validan superadmin adentro, igual que
-- `admin_metricas_inmobiliaria` (migración 20260922140000).
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
-- `metodo_cobro` arranca en MERCADO_PAGO para todas las filas existentes: es
-- lo que son hoy, y así el webhook sigue operando exactamente igual sobre
-- ellas. Una cuenta pasa a MANUAL recién cuando se le registra un pago manual.
alter table public.inmobiliarias
  add column if not exists metodo_cobro text not null default 'MERCADO_PAGO';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inmobiliarias'::regclass
      and conname = 'inmobiliarias_metodo_cobro_check'
  ) then
    alter table public.inmobiliarias
      add constraint inmobiliarias_metodo_cobro_check
      check (metodo_cobro in ('MERCADO_PAGO', 'MANUAL'));
  end if;
end
$$;

-- Columna propia y NO `fecha_proximo_cobro`: esa ya significa dos cosas según
-- el caso (cuándo cobra MP, o hasta cuándo hay acceso en una baja diferida) y
-- la escribe el webhook. Mezclarle un tercer significado dejaría a las dos
-- vías de cobro peleando por la misma columna.
alter table public.inmobiliarias
  add column if not exists acceso_pagado_hasta timestamptz;

comment on column public.inmobiliarias.metodo_cobro is
  'MERCADO_PAGO (suscripción automática) o MANUAL (transferencia/efectivo registrada por el superadmin).';
comment on column public.inmobiliarias.acceso_pagado_hasta is
  'Sólo para metodo_cobro = MANUAL: hasta cuándo cubre el último pago registrado.';

-- ---------------------------------------------------------------------------
-- 2. El cron diario
-- ---------------------------------------------------------------------------
-- Las tres reglas existentes quedan EXACTAMENTE como estaban; las dos nuevas
-- van al final y sólo alcanzan a `metodo_cobro = 'MANUAL'`, así que ninguna
-- cuenta de Mercado Pago cambia de comportamiento.
--
-- Se conservan la firma y el resto de los atributos (plpgsql, returns void,
-- SIN security definer): la llama el job
-- `procesar-transiciones-suscripcion-diario` (ver
-- 20260911120000_respaldo_crons.sql) y sigue corriendo con los permisos de
-- quien la ejecuta, no con los del dueño de la función.
--
-- Lo único que se agrega es `set search_path = public`. Sin eso, la función
-- resuelve `inmobiliarias` contra el search_path de quien la llama: hoy el job
-- de pg_cron la encuentra, pero cualquier cambio en esa configuración —o una
-- tabla `inmobiliarias` en otro esquema que quede antes— la haría fallar en
-- silencio de noche, o peor, escribir en la tabla equivocada. Fijarlo la deja
-- apuntando siempre a `public`.
create or replace function public.procesar_transiciones_suscripcion()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- 1) Gracia agotada: el cobro falló hace más de un día y no se recuperó.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where estado_suscripcion = 'GRACIA'
     and fecha_ultimo_pago_fallido < now() - interval '1 day';

  -- 2) Trial terminado sin haber contratado.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where estado_suscripcion = 'TRIAL'
     and fecha_fin_trial < now();

  -- 3) Baja pedida que llegó a su fecha de corte: el período pago terminó.
  update inmobiliarias
     set estado_suscripcion = 'CANCELADA'
   where estado_suscripcion = 'ACTIVA'
     and cancelacion_solicitada = true
     and fecha_proximo_cobro < now();

  -- 4) Cuenta manual cuyo pago se terminó: entra en gracia. Es el reemplazo
  --    del webhook, que es quien vencería a una cuenta de Mercado Pago. Se
  --    usa GRACIA y no VENCIDA para darle los mismos días de colchón que a un
  --    cobro con tarjeta fallido: sigue entrando a la app y ve el aviso.
  update inmobiliarias
     set estado_suscripcion = 'GRACIA'
   where metodo_cobro = 'MANUAL'
     and estado_suscripcion = 'ACTIVA'
     and acceso_pagado_hasta < now();

  -- 5) Cuenta manual que no renovó en tres días: pierde el acceso. El corte
  --    se mide contra `acceso_pagado_hasta` y no contra
  --    `fecha_ultimo_pago_fallido` —que en una cuenta manual nadie escribe—,
  --    así que la regla 1 nunca la alcanza.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where metodo_cobro = 'MANUAL'
     and estado_suscripcion = 'GRACIA'
     and acceso_pagado_hasta < now() - interval '3 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Registrar un pago manual
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque escribe `inmobiliarias` y `eventos_facturacion`, que
-- no tienen ninguna policy de UPDATE ni de INSERT para `authenticated`: ni el
-- dueño ni el superadmin pueden tocarlas desde el navegador. Esta función es
-- la única puerta, y valida superadmin adentro antes de escribir nada.
--
-- Devuelve el nuevo `acceso_pagado_hasta` para que la UI muestre hasta cuándo
-- quedó cubierta la cuenta sin tener que releerla.
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

  -- Cupo de usuarios: mismo criterio que `marcarActiva` en
  -- webhook-mercadopago/index.ts. Si `planes_cupo` tiene fila para el plan se
  -- copia tal cual (NULL incluido, que ahí significa "sin tope"); si no la
  -- tiene, el cupo se deja como estaba en vez de bajárselo a quien acaba de
  -- pagar.
  select limite_usuarios into v_limite_usuarios
  from public.planes_cupo
  where plan = p_plan;
  v_aplicar_cupo := found;

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
-- 4. Ajustar el vencimiento a mano
-- ---------------------------------------------------------------------------
-- Para corregir un error de carga o dar un plazo excepcional. Pide nota
-- obligatoria: sin motivo escrito, una fecha corrida a mano es indistinguible
-- de un error, y esto queda como el registro de por qué se movió.
create or replace function public.admin_ajustar_vencimiento(
  p_inmobiliaria_id uuid,
  p_nuevo_hasta timestamptz,
  p_nota text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta   public.inmobiliarias%rowtype;
  v_anterior timestamptz;
  v_estado   public.estado_suscripcion;
  v_nota     text;
  v_zona     text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se ajusta el vencimiento.';
  end if;

  if p_nuevo_hasta is null then
    raise exception 'Falta la fecha nueva de vencimiento.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  if v_cuenta.metodo_cobro <> 'MANUAL' then
    raise exception 'Esta cuenta cobra por Mercado Pago: su vencimiento lo maneja el webhook. Registrá un pago manual primero.';
  end if;

  v_anterior := v_cuenta.acceso_pagado_hasta;
  v_estado := v_cuenta.estado_suscripcion;

  -- Adelantar la fecha reactiva la cuenta; atrasarla NO la vence acá. De eso
  -- se encarga el cron con las reglas 4 y 5, que son las mismas para todos y
  -- respetan los tres días de gracia.
  if p_nuevo_hasta > now() and v_cuenta.estado_suscripcion in ('GRACIA', 'VENCIDA') then
    v_estado := 'ACTIVA';
  end if;

  update public.inmobiliarias
     set acceso_pagado_hasta = p_nuevo_hasta,
         estado_suscripcion  = v_estado,
         fecha_ultimo_pago_fallido = case when v_estado = 'ACTIVA' then null
                                          else fecha_ultimo_pago_fallido end
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'ajuste_vencimiento',
    null,
    'ARS',
    'Vencimiento ajustado de '
      || coalesce(to_char(v_anterior at time zone v_zona, 'DD/MM/YYYY'), 'sin fecha')
      || ' a ' || to_char(p_nuevo_hasta at time zone v_zona, 'DD/MM/YYYY')
      || ' · Nota: ' || v_nota,
    jsonb_build_object(
      'acceso_hasta_anterior', v_anterior,
      'acceso_hasta_nuevo', p_nuevo_hasta,
      'estado_anterior', v_cuenta.estado_suscripcion,
      'estado_nuevo', v_estado,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );
end;
$$;

revoke execute on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) to authenticated;

comment on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) is
  'Panel /admin: corrige a mano el vencimiento de una cuenta manual. Nota obligatoria. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 5. Precio nuevo del plan SOLO
-- ---------------------------------------------------------------------------
-- 23100 = 15 USD × 1540,1 (la última `cotizacion_usada`) redondeado a la
-- centena, que es lo mismo que hace `redondearACentena` en
-- actualizar-precios-planes. `cotizacion_usada` no se toca: la cotización es
-- la misma, lo que cambió es el precio en dólares. El lunes que viene el cron
-- lo recalcula solo con el MEP del día.
update public.planes_precio
   set precio_usd = 15,
       precio_ars_actual = 23100,
       actualizado_at = now()
 where plan = 'SOLO';
