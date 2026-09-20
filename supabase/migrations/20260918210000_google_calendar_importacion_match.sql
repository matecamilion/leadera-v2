-- Google Calendar Fase 2: piezas de base que usa la función google-calendar-import.
--
-- Idempotente: se puede correr más de una vez.

-- ---------------------------------------------------------------------------
-- 1. Match difuso de direcciones
-- ---------------------------------------------------------------------------
-- Devuelve las propiedades de UNA inmobiliaria más parecidas a una dirección
-- libre, con su puntaje. La decisión (match fuerte / débil / ambiguo) la toma
-- la función, que además exige que coincida la altura; acá sólo se ordena.
--
-- Puntaje = el mayor entre:
--   - similarity(): parecido de los dos textos enteros.
--   - word_similarity(evento, propiedad): cuánto del texto del evento aparece
--     dentro de la dirección cargada. Es lo que hace que "Alvear 3355" matchee
--     fuerte contra "Alvear 3355, piso 6", donde similarity() sola da bajo
--     porque la dirección cargada tiene más texto.
--
-- El WHERE usa los operadores de pg_trgm para aprovechar el índice
-- `propiedades_direccion_trgm_idx`; con el umbral por defecto (0.3) sólo
-- descarta lo que no se parece en nada.
--
-- Sin SECURITY DEFINER y sin permiso para anon/authenticated: recibe la
-- inmobiliaria por parámetro, así que expuesta a la API permitiría consultar
-- direcciones de otra inmobiliaria. Sólo la llama la función con service_role.
create or replace function public.buscar_propiedad_por_direccion(
  p_inmobiliaria_id uuid,
  p_direccion text
)
returns table (propiedad_id uuid, direccion text, puntaje real)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id,
    p.direccion,
    greatest(
      similarity(lower(p.direccion), lower(p_direccion)),
      word_similarity(lower(p_direccion), lower(p.direccion))
    ) as puntaje
  from public.propiedades p
  where p.inmobiliaria_id = p_inmobiliaria_id
    and (
      lower(p.direccion) % lower(p_direccion)
      or lower(p_direccion) <% lower(p.direccion)
    )
  order by puntaje desc
  limit 3;
$$;

revoke all on function public.buscar_propiedad_por_direccion(uuid, text) from public, anon, authenticated;
grant execute on function public.buscar_propiedad_por_direccion(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Fallos seguidos de importación
-- ---------------------------------------------------------------------------
-- Un error transitorio (reloj desfasado entre servicios, Google que no
-- contesta, un 5xx) suma acá y NO se escribe en importacion_ultimo_error:
-- la próxima corrida lo reintenta. Recién cuando se repite varias corridas
-- seguidas se registra como error. Una corrida buena lo vuelve a 0.
alter table public.google_calendar_tokens
  add column if not exists importacion_fallos_seguidos integer not null default 0;
