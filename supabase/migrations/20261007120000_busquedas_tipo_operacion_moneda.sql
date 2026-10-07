-- Aplicada manualmente en producción el 07/10/2026
begin;

alter table public.busquedas
  add column tipo_operacion text,
  add column moneda text not null default 'USD';

alter table public.busquedas
  add constraint busquedas_tipo_operacion_check
    check (tipo_operacion in ('COMPRA', 'ALQUILER')),
  add constraint busquedas_moneda_check
    check (moneda in ('USD', 'ARS'));

update public.busquedas b
set tipo_operacion = case o.tipo
                       when 'COMPRA' then 'COMPRA'
                       when 'BUSQUEDA_ALQUILER' then 'ALQUILER'
                     end
from public.operaciones o
where o.busqueda_id = b.id
  and o.tipo in ('COMPRA', 'BUSQUEDA_ALQUILER');

commit;
