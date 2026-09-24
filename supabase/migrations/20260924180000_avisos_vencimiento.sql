-- Registro de los avisos de vencimiento por mail.
--
-- La Edge Function `avisos-vencimiento` le escribe al dueño de cada cuenta de
-- cobro manual antes de que venza, el día que vence y el último día de gracia.
-- Esta tabla es lo que evita que un mismo aviso salga dos veces: la función
-- corre una vez por día, pero nada impide dispararla a mano o que el cron la
-- repita, y un "tu plan vence" duplicado desgasta al que lo recibe.
--
-- La clave es (inmobiliaria, vencimiento, tipo) y no (inmobiliaria, tipo):
-- cuando la cuenta renueva, `acceso_pagado_hasta` cambia y los tres avisos del
-- ciclo nuevo tienen que poder salir aunque los del ciclo anterior ya estén.
--
-- Una fila en ERROR no bloquea: la corrida del día siguiente la reintenta
-- mientras el aviso siga vigente. ENVIANDO es el reclamo que toma una corrida
-- antes de llamar a Resend, para que dos corridas simultáneas no manden el
-- mismo mail.
--
-- Sólo la usa la service role. RLS activado y sin ninguna policy: ni el dueño
-- ni el superadmin la leen desde el navegador. No toca ninguna policy ni RLS
-- existente.
--
-- El cron que dispara la función va en una migración aparte, para activarlo
-- recién después de revisar el dry run.
--
-- Idempotente.

create table if not exists public.avisos_vencimiento (
  id              uuid primary key default gen_random_uuid(),
  inmobiliaria_id uuid not null references public.inmobiliarias(id) on delete cascade,
  -- Copia exacta de `inmobiliarias.acceso_pagado_hasta` al momento del aviso.
  vencimiento     timestamptz not null,
  tipo            text not null,
  estado          text not null,
  email           text,
  resend_id       text,
  error           text,
  intentos        int not null default 1,
  created_at      timestamptz not null default now(),
  actualizado_at  timestamptz not null default now(),
  enviado_at      timestamptz,
  constraint avisos_vencimiento_tipo_check
    check (tipo in ('PREVIO', 'DIA_VENCIMIENTO', 'ULTIMO_DIA_GRACIA')),
  constraint avisos_vencimiento_estado_check
    check (estado in ('ENVIANDO', 'ENVIADO', 'ERROR')),
  constraint avisos_vencimiento_unico unique (inmobiliaria_id, vencimiento, tipo)
);

alter table public.avisos_vencimiento enable row level security;

-- Sin policies alcanza para que no se lea nada, pero el grant por defecto de
-- Supabase a anon y authenticated la dejaría visible en la API apenas alguien
-- agregue una policy sin pensarlo. Se corta también desde el grant.
revoke all on table public.avisos_vencimiento from anon, authenticated;

comment on table public.avisos_vencimiento is
  'Avisos de vencimiento enviados por la Edge Function avisos-vencimiento. Clave única por (inmobiliaria, vencimiento, tipo). Sólo service role.';
