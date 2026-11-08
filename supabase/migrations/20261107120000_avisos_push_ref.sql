-- Log de avisos push: columna `ref` y tipos de aviso de visitas.
--
-- Los avisos de visitas (VISITA_PROXIMA y VISITA_POST) pueden ser varios por
-- usuario y día: cada visita tiene los suyos. Con la clave (usuario, tipo,
-- fecha) la segunda visita del día chocaría con la primera. Se agrega `ref`
-- como discriminador y la clave pasa a (usuario, tipo, fecha, ref).
--
-- Compatibilidad con el resumen diario: sus filas quedan con ref = '' (el
-- default), y la función no lo escribe ni lo lee. Su insert, su
-- `.match({ user_id, tipo, fecha })` y sus updates por id siguen apuntando a una
-- única fila, porque para RESUMEN_DIARIO el único ref posible es ''.
--
-- Solo toca public.avisos_push_enviados. Las filas existentes no cambian de
-- valor: reciben ref = ''.
--
-- Idempotente: add column if not exists; drop constraint if exists antes de
-- cada add constraint. Correrla dos veces deja la tabla igual.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columna ref
-- ---------------------------------------------------------------------------
-- not null default '': las filas del resumen diario no necesitan discriminador
-- y así la clave única nunca compara contra null (que no choca con nada).

alter table public.avisos_push_enviados
  add column if not exists ref text not null default '';

alter table public.avisos_push_enviados
  drop constraint if exists avisos_push_enviados_ref_check;
alter table public.avisos_push_enviados
  add constraint avisos_push_enviados_ref_check
    check (char_length(ref) <= 200);

-- ---------------------------------------------------------------------------
-- 2. Clave única con ref
-- ---------------------------------------------------------------------------

alter table public.avisos_push_enviados
  drop constraint if exists avisos_push_enviados_unico;
alter table public.avisos_push_enviados
  add constraint avisos_push_enviados_unico
    unique (user_id, tipo, fecha, ref);

-- ---------------------------------------------------------------------------
-- 3. Tipos de aviso
-- ---------------------------------------------------------------------------

alter table public.avisos_push_enviados
  drop constraint if exists avisos_push_enviados_tipo_check;
alter table public.avisos_push_enviados
  add constraint avisos_push_enviados_tipo_check
    check (tipo in ('RESUMEN_DIARIO', 'VISITA_PROXIMA', 'VISITA_POST'));

-- ---------------------------------------------------------------------------
-- 4. Comentarios
-- ---------------------------------------------------------------------------

comment on table public.avisos_push_enviados is
  'Avisos push enviados por las Edge Functions de avisos. Clave única por (usuario, tipo, fecha, ref). Sólo service role.';
comment on column public.avisos_push_enviados.tipo is
  'Clase de aviso: RESUMEN_DIARIO, VISITA_PROXIMA o VISITA_POST. Se amplía con una migración futura.';
comment on column public.avisos_push_enviados.fecha is
  'RESUMEN_DIARIO: día calendario de Argentina de la corrida (no UTC). VISITA_PROXIMA y VISITA_POST: día de la visita.';
comment on column public.avisos_push_enviados.ref is
  'Discriminador dentro de (usuario, tipo, fecha). Vacío para RESUMEN_DIARIO; visita_id || ''@'' || hora para los avisos de visitas, así un cambio de hora genera un aviso nuevo. Máximo 200 caracteres.';

commit;
