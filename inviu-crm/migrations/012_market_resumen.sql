-- ══════════════════════════════════════════════════════════════════════
-- 012_market_resumen.sql — Resumen diario de mercados para Nova (Research)
-- Idempotente. Mismo patrón de RLS que el resto (user_id, no owner_id).
--
-- La llena una tarea programada que lee el mail "Resumen Diario de
-- Mercados" (ya se genera solo cada mañana) y arma: los números clave,
-- un texto corto listo para pegar en WhatsApp, y una tarjeta PNG con el
-- resumen del día (subida al bucket de Storage "market-cards").
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.market_resumen (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  sp500_fut numeric,
  nasdaq_fut numeric,
  dow_fut numeric,
  ust10y numeric,
  riesgo_pais integer,
  riesgo_pais_var numeric,
  merval_var numeric,
  dolar_mep numeric,
  dolar_ccl numeric,
  dolar_blue numeric,
  radar_texto text,
  wpp_texto text,
  imagen_url text,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id)
);
create unique index if not exists market_resumen_fecha_user_idx on public.market_resumen(fecha, user_id);
create index if not exists market_resumen_fecha_idx on public.market_resumen(fecha);

alter table public.market_resumen enable row level security;
drop policy if exists "own rows" on public.market_resumen;
create policy "own rows" on public.market_resumen
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket público para las tarjetas PNG (público de lectura porque Lucas
-- las va a compartir afuera del CRM, en WhatsApp — no llevan datos de
-- clientes, solo indicadores de mercado ya públicos).
insert into storage.buckets (id, name, public)
values ('market-cards', 'market-cards', true)
on conflict (id) do nothing;

drop policy if exists "market-cards own write" on storage.objects;
create policy "market-cards own write" on storage.objects
  for all to public
  using (bucket_id = 'market-cards' and auth.uid() = owner)
  with check (bucket_id = 'market-cards' and auth.uid() = owner);

drop policy if exists "market-cards public read" on storage.objects;
create policy "market-cards public read" on storage.objects
  for select to public
  using (bucket_id = 'market-cards');
