-- ══════════════════════════════════════════════════════════════════════
-- 012_morning_call.sql — Pestaña "Morning Call" del CRM
-- Idempotente. Mismo patrón de RLS que el resto (user_id + auth.uid()).
--
-- La tarea programada de las 9:12 (guion + imagen) guarda cada día el
-- guion del audio y la imagen "Resumen del día" acá, llamando a la función
-- publicar_morning_call() con un token. El CRM solo LEE esta tabla.
--
-- IMPORTANTE: el token NO va en este archivo (el repo es público).
-- Se carga aparte, una sola vez, desde el SQL Editor de Supabase:
--   insert into public.integration_tokens (name, token_hash, user_id)
--   select 'morning_call', encode(sha256(convert_to('<TOKEN>','UTF8')),'hex'), id
--   from auth.users where email = 'lucas29olavarria@gmail.com'
--   on conflict (name) do update set token_hash = excluded.token_hash;
-- ══════════════════════════════════════════════════════════════════════

-- 1) Tabla con un registro por día
create table if not exists public.morning_call (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  guion text not null,
  imagen_png text,          -- imagen como data URL (data:image/png;base64,...)
  datos jsonb,              -- los números que se usaron para la imagen
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id),
  unique (user_id, fecha)
);
create index if not exists morning_call_fecha_idx on public.morning_call(fecha desc);

alter table public.morning_call enable row level security;
drop policy if exists "own rows" on public.morning_call;
create policy "own rows" on public.morning_call
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Tokens de integración (solo el hash). Sin políticas: nadie la puede
--    leer ni escribir por la API; solo las funciones security definer.
create table if not exists public.integration_tokens (
  name text primary key,
  token_hash text not null,
  user_id uuid not null references auth.users(id)
);
alter table public.integration_tokens enable row level security;

-- 3) Función que usa la tarea programada para publicar el día.
--    Valida el token y escribe a nombre del dueño del token.
create or replace function public.publicar_morning_call(
  p_token text,
  p_fecha date,
  p_guion text,
  p_imagen_png text default null,
  p_datos jsonb default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user
  from public.integration_tokens
  where name = 'morning_call'
    and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  if v_user is null then
    raise exception 'token inválido';
  end if;

  if p_imagen_png is not null and p_imagen_png not like 'data:image/png;base64,%' then
    raise exception 'imagen_png tiene que ser un data URL de PNG';
  end if;

  insert into public.morning_call (fecha, guion, imagen_png, datos, user_id)
  values (p_fecha, p_guion, p_imagen_png, p_datos, v_user)
  on conflict (user_id, fecha) do update
    set guion = excluded.guion,
        imagen_png = coalesce(excluded.imagen_png, public.morning_call.imagen_png),
        datos = coalesce(excluded.datos, public.morning_call.datos),
        created_at = now();

  return 'ok';
end;
$$;

revoke all on function public.publicar_morning_call(text, date, text, text, jsonb) from public;
grant execute on function public.publicar_morning_call(text, date, text, text, jsonb) to anon, authenticated;
