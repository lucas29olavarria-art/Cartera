-- ══════════════════════════════════════════════════════════════════════
-- 011_depositos.sql — Historial real de depósitos (no solo una fecha)
-- Idempotente. Mismo patrón de RLS que el resto (user_id, no owner_id).
-- La llena la tarea programada de Gmail; ultimo_deposito en clients
-- (de 010_zafira.sql) se sigue usando como "último" para la alerta de
-- Zafira, pero acá queda el registro completo con monto y moneda.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.depositos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id)
);
create index if not exists depositos_client_id_idx on public.depositos(client_id);
create index if not exists depositos_fecha_idx on public.depositos(fecha);

alter table public.depositos enable row level security;
drop policy if exists "own rows" on public.depositos;
create policy "own rows" on public.depositos
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
