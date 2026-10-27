-- ══════════════════════════════════════════════════════════════════════
-- 000_audit.sql — Diagnóstico de RLS antes de tocar nada
-- Correr tal cual en el SQL Editor de Supabase (proyecto del CRM:
-- vqxcmooloynecpvyeghv) y pegar el resultado de vuelta.
-- No modifica nada, es solo lectura.
-- ══════════════════════════════════════════════════════════════════════

-- 1) ¿Tienen RLS habilitado estas 6 tablas?
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('clients','flows','agenda','issuers','advisor_settings','tenencias_snapshots')
order by tablename;

-- 2) Políticas existentes sobre esas tablas (si rowsecurity=false arriba,
--    estas políticas no se están aplicando igual — la tabla queda abierta).
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('clients','flows','agenda','issuers','advisor_settings','tenencias_snapshots')
order by tablename, policyname;

-- 3) Columnas actuales de cada tabla (para confirmar si ya existe
--    owner_id/user_id y de qué tipo, antes de migrar).
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('clients','flows','agenda','issuers','advisor_settings','tenencias_snapshots')
order by table_name, ordinal_position;

-- 4) Grants directos de los roles anon/authenticated sobre estas tablas
--    (esto es lo que determina si el anon key puede leer/escribir hoy).
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('clients','flows','agenda','issuers','advisor_settings','tenencias_snapshots')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- 5) Constraints únicos existentes (para no romper nada al migrar,
--    ej. "ticker" único en issuers que debería pasar a ser único por owner_id).
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.table_name in ('clients','flows','agenda','issuers','advisor_settings','tenencias_snapshots')
  and tc.constraint_type in ('UNIQUE','PRIMARY KEY')
group by tc.table_name, tc.constraint_name, tc.constraint_type
order by tc.table_name, tc.constraint_type;
