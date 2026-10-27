-- ══════════════════════════════════════════════════════════════════════
-- 010_zafira.sql — Tablas para "Zafira" (a quién contactar hoy)
-- Idempotente — se puede correr varias veces sin romper nada.
-- Sigue el mismo patrón que ya está en las 6 tablas existentes:
-- user_id uuid NOT NULL DEFAULT auth.uid() + RLS con auth.uid()=user_id.
-- (Nota: el plan original decía "owner_id" — se usa "user_id" a propósito,
-- por la decisión tomada al migrar seguridad: inviu-crm/SECURITY.md.)
-- ══════════════════════════════════════════════════════════════════════

-- 1) Tabla contactos: historial de "lo contacté" por cliente.
create table if not exists public.contactos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('llamada','whatsapp','mail','reunion')),
  nota text,
  user_id uuid not null default auth.uid() references auth.users(id)
);
create index if not exists contactos_client_id_idx on public.contactos(client_id);

alter table public.contactos enable row level security;
drop policy if exists "own rows" on public.contactos;
create policy "own rows" on public.contactos
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Tabla agent_runs: una fila por agente por corrida, la lee la Oficina.
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('zafira','nova','midas','chispa')),
  created_at timestamptz not null default now(),
  estado text not null default 'ok' check (estado in ('ok','error','pendiente')),
  titulo text,
  resumen text,
  payload jsonb,
  requiere_accion boolean not null default false,
  user_id uuid not null default auth.uid() references auth.users(id)
);
create index if not exists agent_runs_agent_created_idx on public.agent_runs(agent, created_at desc);

alter table public.agent_runs enable row level security;
drop policy if exists "own rows" on public.agent_runs;
create policy "own rows" on public.agent_runs
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Columnas nuevas en clients (cumpleaños + último depósito detectado).
alter table public.clients add column if not exists birthday date;
alter table public.clients add column if not exists ultimo_deposito date;

-- 4) Config de Zafira en advisor_settings (umbrales de alerta, editables
--    desde Ajustes). Defaults según el plan original.
alter table public.advisor_settings add column if not exists zafira_config jsonb
  not null default '{"dias_sin_contacto":45,"dias_sin_deposito":90,"dias_cobro_cerca":7,"dias_reinversion":3,"dias_cliente_nuevo":30}'::jsonb;

-- 5) Plantillas de mensajes por tipo de alerta, también en advisor_settings
--    (texto editable desde Ajustes, con variables {nombre},{ticker},{fecha},{monto}).
alter table public.advisor_settings add column if not exists zafira_templates jsonb
  not null default '{
    "sin_contacto": "Hola {nombre}! Hace un tiempo que no hablamos, ¿cómo venís? Te escribo para ver cómo seguís con tus inversiones.",
    "sin_deposito": "Hola {nombre}! Vi que hace un tiempo no sumás a la cuenta. ¿Charlamos 10 minutos para ver si hay algo para optimizar?",
    "cobro_cerca": "Hola {nombre}! Te aviso que el {fecha} cobrás {ticker}. Cualquier cosa que necesites, acá estoy.",
    "reinversion": "Hola {nombre}! Vi que te entró un cobro de {monto}. Si querés pensamos juntos dónde reinvertirlo para que no quede quieto.",
    "cumpleanos": "Feliz cumple {nombre}! Que lo pases muy bien 🎉",
    "cliente_nuevo": "Hola {nombre}! Bienvenido/a. Cualquier duda que tengas con la cuenta, escribime sin problema."
  }'::jsonb;
