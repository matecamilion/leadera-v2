-- YA APLICADA en producción el 30/10/2026 (pegada en el SQL Editor). No volver a ejecutar.

-- ============================================================================
-- Trámite posterior al acuerdo — pasos por operación (Etapa 1, tabla)
--
-- Por qué: en una compraventa, después de aceptado el acuerdo empieza un
-- trámite de 45-60 días (escribanía, documentación, certificados, escritura).
-- Cada operación de VENTA/COMPRA lleva un checklist de seis pasos, y marcar la
-- escritura dispara las tareas de postventa.
--
-- La tabla es hija de `operaciones` y NO depende del estado de la operación:
-- `proteger_operacion_cerrada` solo congela titulo, monto, moneda, notas, tipo,
-- lead_id, propiedad_id y busqueda_id una vez cerrada, así que el trámite se
-- sigue editando con la operación en CERRADA_GANADA.
--
-- Una fila por (operación, paso), creada la primera vez que alguien lo toca. Un
-- paso sin fila es un paso pendiente.
--
--   fecha_completado  Fecha (día de Buenos Aires) en que ocurrió el paso. La
--                     escribe el cliente y es editable: el agente puede marcar
--                     el paso días después de que pasó. Sin fecha ni no_aplica
--                     = pendiente. Desmarcar = ponerla en null.
--   no_aplica         El paso no corresponde a esta operación.
--   fecha_prevista    Solo ESCRITURA: cuándo se espera firmar.
--   postventa_generada_at
--                     Solo ESCRITURA: cuándo se generaron las tareas de
--                     postventa. Evita duplicarlas si se marca, se desmarca y se
--                     vuelve a marcar.
--
-- Permisos: mismos que `operaciones_update`. Sin policy de DELETE: desmarcar un
-- paso es poner fecha_completado en null, y el borrado de la operación arrastra
-- las filas por la cascada (que no pasa por RLS).
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
begin
  if to_regclass('public.operaciones') is null
     or to_regclass('public.inmobiliarias') is null
     or to_regclass('public.profiles') is null then
    raise exception 'ABORTADO: faltan public.operaciones, public.inmobiliarias o public.profiles.';
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'ABORTADO: falta public.set_updated_at().';
  end if;

  if to_regprocedure('private.my_inmobiliaria_id()') is null
     or to_regprocedure('private.my_rol()') is null
     or to_regprocedure('private.my_asiste_a()') is null then
    raise exception
      'ABORTADO: falta private.my_inmobiliaria_id(), my_rol() o my_asiste_a().';
  end if;

  if to_regclass('public.operacion_tramite_pasos') is not null then
    raise exception 'ABORTADO: public.operacion_tramite_pasos ya existe.';
  end if;
end
$$;

-- 1. Tabla --------------------------------------------------------------------

create table public.operacion_tramite_pasos (
  id                    uuid primary key default gen_random_uuid(),
  inmobiliaria_id       uuid not null references public.inmobiliarias (id) on delete cascade,
  operacion_id          uuid not null references public.operaciones (id) on delete cascade,
  paso                  text not null,
  fecha_completado      date,
  no_aplica             boolean not null default false,
  fecha_prevista        date,
  postventa_generada_at timestamptz,
  completado_por        uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint operacion_tramite_pasos_unico
    unique (operacion_id, paso),
  -- text + check y no enum: agregar o renombrar un paso es un ALTER de la
  -- constraint, no de un tipo. Mismas claves que PASOS_TRAMITE (src/lib/tramite.ts).
  constraint operacion_tramite_pasos_paso_valido
    check (paso in (
      'PRESUPUESTOS_PEDIDOS',
      'ESCRIBANIA_ELEGIDA',
      'DOCUMENTACION_ENVIADA',
      'CERTIFICADOS_PEDIDOS',
      'CERTIFICADOS_RECIBIDOS',
      'ESCRITURA'
    )),
  constraint operacion_tramite_pasos_completado_o_no_aplica
    check (not (fecha_completado is not null and no_aplica)),
  constraint operacion_tramite_pasos_prevista_solo_escritura
    check (fecha_prevista is null or paso = 'ESCRITURA'),
  constraint operacion_tramite_pasos_postventa_solo_escritura
    check (postventa_generada_at is null or paso = 'ESCRITURA')
);

comment on table public.operacion_tramite_pasos is
  'Checklist del trámite posterior al acuerdo de una operación de VENTA/COMPRA. Una fila por (operación, paso); sin fila = pendiente. Independiente del estado de la operación.';

comment on column public.operacion_tramite_pasos.fecha_completado is
  'Día (Buenos Aires) en que ocurrió el paso. Editable. Null y no_aplica = false: pendiente.';

comment on column public.operacion_tramite_pasos.postventa_generada_at is
  'Solo ESCRITURA: cuándo se generaron las tareas de postventa. Evita duplicarlas al marcar, desmarcar y volver a marcar.';

create trigger operacion_tramite_pasos_set_updated_at
  before update on public.operacion_tramite_pasos
  for each row
  execute function public.set_updated_at();

-- 2. RLS y grants -------------------------------------------------------------

alter table public.operacion_tramite_pasos enable row level security;

revoke all on table public.operacion_tramite_pasos from public, anon, authenticated;
grant select, insert, update on table public.operacion_tramite_pasos to authenticated;

-- Misma condición que `operaciones_update`, vía EXISTS sobre la operación:
--   misma inmobiliaria y
--     DUEÑO, o
--     agente de la operación, o
--     asistente del agente de la operación.
--
-- `(select ...)` entre paréntesis: se evalúa una vez por consulta (InitPlan),
-- no una vez por fila.

create policy operacion_tramite_pasos_select
  on public.operacion_tramite_pasos
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.operaciones o
       where o.id = operacion_tramite_pasos.operacion_id
         and o.inmobiliaria_id = (select private.my_inmobiliaria_id())
         and (
           (select private.my_rol())::text = 'DUENO'
           or o.agente_id = (select auth.uid())
           or (
             (select private.my_rol())::text = 'ASISTENTE'
             and o.agente_id = (select private.my_asiste_a())
           )
         )
    )
  );

create policy operacion_tramite_pasos_insert
  on public.operacion_tramite_pasos
  for insert
  to authenticated
  with check (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and exists (
      select 1
        from public.operaciones o
       where o.id = operacion_tramite_pasos.operacion_id
         and o.inmobiliaria_id = (select private.my_inmobiliaria_id())
         and (
           (select private.my_rol())::text = 'DUENO'
           or o.agente_id = (select auth.uid())
           or (
             (select private.my_rol())::text = 'ASISTENTE'
             and o.agente_id = (select private.my_asiste_a())
           )
         )
    )
  );

create policy operacion_tramite_pasos_update
  on public.operacion_tramite_pasos
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.operaciones o
       where o.id = operacion_tramite_pasos.operacion_id
         and o.inmobiliaria_id = (select private.my_inmobiliaria_id())
         and (
           (select private.my_rol())::text = 'DUENO'
           or o.agente_id = (select auth.uid())
           or (
             (select private.my_rol())::text = 'ASISTENTE'
             and o.agente_id = (select private.my_asiste_a())
           )
         )
    )
  )
  with check (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and exists (
      select 1
        from public.operaciones o
       where o.id = operacion_tramite_pasos.operacion_id
         and o.inmobiliaria_id = (select private.my_inmobiliaria_id())
         and (
           (select private.my_rol())::text = 'DUENO'
           or o.agente_id = (select auth.uid())
           or (
             (select private.my_rol())::text = 'ASISTENTE'
             and o.agente_id = (select private.my_asiste_a())
           )
         )
    )
  );

-- 3. Verificación final -------------------------------------------------------

do $$
declare
  p text;
begin
  foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.operacion_tramite_pasos', p) then
      raise exception 'ABORTADO: anon tiene % sobre operacion_tramite_pasos.', p;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.operacion_tramite_pasos', 'DELETE') then
    raise exception 'ABORTADO: authenticated puede borrar en operacion_tramite_pasos.';
  end if;

  if not exists (
    select 1 from pg_class
     where oid = 'public.operacion_tramite_pasos'::regclass
       and relrowsecurity
  ) then
    raise exception 'ABORTADO: operacion_tramite_pasos quedó sin RLS.';
  end if;
end
$$;

commit;
