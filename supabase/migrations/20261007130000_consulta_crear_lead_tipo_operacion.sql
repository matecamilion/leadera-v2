-- ============================================================================
-- consulta_crear_lead: la búsqueda sugerida guarda tipo_operacion
--
-- Por qué: 20261007120000 agregó busquedas.tipo_operacion ('COMPRA' |
-- 'ALQUILER' | null). La búsqueda que nace de una consulta lo toma de lo que
-- contestó el cliente en la encuesta (consultas.respuestas->>'operacion'); las
-- operaciones de propietario (VENTA, ALQUILER_PROPIETARIO) no generan búsqueda,
-- y cualquier otro valor queda en null.
--
-- Idéntica a la versión de 20261001120100_consultas.sql salvo el insert en
-- public.busquedas. Misma firma, SECURITY DEFINER, search_path vacío y
-- permisos.
-- ============================================================================

begin;

create or replace function public.consulta_crear_lead(
  p_consulta_id uuid,
  p_estado      public.estado_consulta
)
returns table (resultado text, lead_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c      public.consultas%rowtype;
  v_lead uuid;
  v_msg  text;
begin
  if p_estado not in ('ACEPTADA', 'AUTO_ACEPTADA') then
    raise exception 'Estado inválido para crear lead: %', p_estado
      using errcode = '22023';
  end if;

  select * into c
    from public.consultas
   where id = p_consulta_id
     for update;

  if not found then
    raise exception 'Consulta inexistente.' using errcode = 'P0002';
  end if;

  if c.estado <> 'PENDIENTE' then
    resultado := 'YA_RESUELTA';
    lead_id   := c.lead_id;
    return next;
    return;
  end if;

  begin
    -- `estado` NO se manda: nace en NULL ("Nuevo"), igual que crearLead().
    -- agente_id = el agente del link, mismo campo que llena crearLead().
    insert into public.leads (
      inmobiliaria_id, agente_id, nombre, apellido, telefono, email,
      origen, descripcion_inicial
    ) values (
      c.inmobiliaria_id, c.agente_id, btrim(c.nombre), nullif(btrim(c.apellido), ''),
      btrim(c.telefono), nullif(btrim(c.email), ''),
      'LINK_CONSULTA', c.resumen
    )
    returning id into v_lead;
  exception
    -- leads_verificar_limite. El bloque revierte solo el insert; el lock
    -- sobre la consulta sigue tomado y el update de abajo se guarda.
    when sqlstate 'P0001' then
      v_msg := left(sqlerrm, 500);

      update public.consultas
         set aviso_pendiente = v_msg
       where id = c.id;

      resultado := 'LIMITE_ALCANZADO';
      lead_id   := null;
      return next;
      return;
  end;

  if c.busqueda is not null then
    insert into public.busquedas (
      inmobiliaria_id, lead_id, agente_id,
      tipo_propiedad, zona, precio_min, precio_max, notas, tipo_operacion
    ) values (
      c.inmobiliaria_id, v_lead, c.agente_id,
      (c.busqueda ->> 'tipo_propiedad')::public.tipo_propiedad,
      nullif(c.busqueda ->> 'zona', ''),
      (c.busqueda ->> 'precio_min')::numeric,
      (c.busqueda ->> 'precio_max')::numeric,
      nullif(c.busqueda ->> 'notas', ''),
      case c.respuestas ->> 'operacion'
        when 'COMPRA'   then 'COMPRA'
        when 'ALQUILER' then 'ALQUILER'
        else null
      end
    );
  end if;

  update public.consultas
     set estado          = p_estado,
         lead_id         = v_lead,
         aviso_pendiente = null,
         resuelta_at     = now(),
         resuelta_por    = auth.uid()   -- null en el pase automático
   where id = c.id;

  resultado := 'OK';
  lead_id   := v_lead;
  return next;
end;
$$;

comment on function public.consulta_crear_lead(uuid, public.estado_consulta) is
  'Interna: crea lead (estado NULL, origen LINK_CONSULTA, agente del link) + búsqueda sugerida desde una consulta PENDIENTE. Si leads_verificar_limite lanza P0001, la deja PENDIENTE con aviso_pendiente. Solo service_role y las RPCs de la bandeja.';

revoke all on function public.consulta_crear_lead(uuid, public.estado_consulta) from public, anon, authenticated;
grant execute on function public.consulta_crear_lead(uuid, public.estado_consulta) to service_role;

commit;
