-- Vista de cuentas en riesgo de perder acceso.
--
-- Aditiva y de sólo lectura: no toca el cron, los webhooks, ni ninguna tabla.
-- Resume el JOIN que hoy hay que escribir a mano cada vez para responder la
-- pregunta operativa "¿a quién le está por cortar el acceso?".
--
-- Junta dos poblaciones distintas porque la acción que disparan es la misma:
--  - TRIAL que vence dentro de 7 días: nunca pagó, y el cron la pasa a VENCIDA.
--  - GRACIA: el cobro falló y el cron la va a vencer si no se resuelve.
--
-- VENCIDA y CANCELADA quedan afuera a propósito: esas cuentas YA perdieron el
-- acceso (son los `ESTADOS_BLOQUEANTES` de src/lib/api/suscripcion.ts), así que
-- no están en riesgo de perderlo, están del otro lado. ACTIVA tampoco entra.
--
-- Nota sobre GRACIA: por sí solo no corta el acceso —`estaBloqueada` lo excluye
-- deliberadamente—, así que una cuenta acá todavía entra a la app con normalidad.
-- Lo que la vuelve urgente es que el cron diario la mueva a VENCIDA.

-- `security_invoker = on` (Postgres 15+; el proyecto corre 17): sin esto la vista
-- se ejecutaría con los permisos de su dueño y SALTEARÍA la RLS de
-- `inmobiliarias` y `profiles`. Como PostgREST publica automáticamente todo lo
-- que vive en `public`, eso dejaría el nombre, el mail, el plan y el estado de
-- cobranza de TODAS las inmobiliarias a un GET de cualquier usuario logueado.
-- Con invoker, cada quien ve lo que su RLS le permita; desde el SQL Editor
-- (rol postgres) se sigue viendo todo, que es el uso para el que se creó.
create or replace view public.vista_cuentas_en_riesgo
with (security_invoker = on) as
select
  i.id,
  i.nombre                                 as inmobiliaria,
  i.estado_suscripcion,
  i.plan,
  i.fecha_fin_trial,
  (i.fecha_fin_trial::date - current_date) as dias_trial_restantes,
  i.fecha_ultimo_pago_fallido,
  i.fecha_proximo_cobro,
  i.mp_preapproval_id,
  i.cancelacion_solicitada,
  d.dueno,
  d.email                                  as email_dueno
from public.inmobiliarias i
-- LEFT JOIN LATERAL y no un JOIN común, por dos razones distintas:
--
--  - LEFT: con un INNER, una inmobiliaria en GRACIA que se quedó sin ningún
--    perfil DUENO —dueño borrado, dato roto— desaparecería del listado sin
--    hacer ruido. En un reporte de riesgo, omitir en silencio justo el caso
--    anómalo es la peor falla posible: se ve una lista limpia y la cuenta se
--    vence igual. Con LEFT aparece, con el dueño en null.
--  - LATERAL ... LIMIT 1: nada impide que una inmobiliaria tenga más de un
--    perfil con rol DUENO (`crear-invitacion` acepta ese rol). Con un join
--    plano, esa cuenta saldría duplicada y se contaría dos veces. Así la vista
--    garantiza una fila por inmobiliaria, que es lo que se espera de un
--    resumen. Se elige el DUENO más antiguo para que el resultado sea estable
--    entre corridas.
left join lateral (
  select
    p.nombre || ' ' || p.apellido as dueno,
    p.email
  from public.profiles p
  where p.inmobiliaria_id = i.id
    and p.rol = 'DUENO'
  order by p.created_at
  limit 1
) d on true
where
  (i.estado_suscripcion = 'TRIAL' and i.fecha_fin_trial < now() + interval '7 days')
  or i.estado_suscripcion = 'GRACIA'
order by
  -- GRACIA primero: es plata que ya falló, contra un trial que todavía puede
  -- convertir. Dentro de cada grupo, lo que vence antes va arriba.
  case when i.estado_suscripcion = 'GRACIA' then 0 else 1 end,
  i.fecha_fin_trial asc;

-- Defensa en profundidad sobre el `security_invoker` de arriba: esta vista es
-- una herramienta interna de backoffice y no la consume el frontend, así que no
-- tiene por qué estar expuesta en la API pública ni siquiera con RLS de por
-- medio. Se usa desde el SQL Editor o con el service role.
revoke all on public.vista_cuentas_en_riesgo from anon, authenticated;

comment on view public.vista_cuentas_en_riesgo is
  'Backoffice: inmobiliarias en riesgo de perder acceso (TRIAL que vence en <=7 días, o GRACIA por cobro rechazado). Sólo lectura, una fila por inmobiliaria. No expuesta a anon/authenticated.';
