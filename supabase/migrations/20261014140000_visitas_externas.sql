begin;

alter table public.visitas
  alter column propiedad_id drop not null,
  add column titulo_externo text,
  add column link_externo text;

-- Propia (con propiedad) o externa (con título), nunca ambas ni ninguna.
-- Una externa no puede tener operación vinculada.
alter table public.visitas
  add constraint visitas_propia_o_externa check (
    (propiedad_id is not null
       and titulo_externo is null
       and link_externo is null)
    or
    (propiedad_id is null
       and operacion_id is null
       and length(btrim(coalesce(titulo_externo, ''))) between 1 and 200)
  ),
  add constraint visitas_link_externo_valido check (
    link_externo is null
    or (link_externo ~* '^https?://' and length(link_externo) <= 2000)
  );

commit;
