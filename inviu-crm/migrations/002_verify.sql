-- ══════════════════════════════════════════════════════════════════════
-- 002_verify.sql — Chequeos de integridad post-audit (solo lectura)
-- Correr en el SQL Editor. Ojo: el SQL Editor corre como un rol con
-- privilegios (normalmente bypassea RLS), así que esto NO prueba que la
-- anon key esté bloqueada — eso lo prueba 002_verify.sh con curl real
-- contra la API REST. Esto es solo un chequeo de integridad de los datos.
-- ══════════════════════════════════════════════════════════════════════

-- 1) ¿Hay filas con user_id NULL? No deberían existir (la columna es
--    NOT NULL), pero si alguna vez se cargó algo por fuera de RLS
--    (ej. con la service_role key a mano) podría haber quedado huérfano
--    e invisible para siempre bajo RLS.
select 'clients' as tabla, count(*) from clients where user_id is null
union all
select 'flows', count(*) from flows where user_id is null
union all
select 'agenda', count(*) from agenda where user_id is null
union all
select 'issuers', count(*) from issuers where user_id is null
union all
select 'advisor_settings', count(*) from advisor_settings where user_id is null
union all
select 'tenencias_snapshots', count(*) from tenencias_snapshots where user_id is null;

-- 2) ¿Todas las filas pertenecen al mismo user_id? Como sos el único
--    usuario, debería haber como máximo 1 valor distinto por tabla.
select 'clients' as tabla, count(distinct user_id) as usuarios_distintos from clients
union all
select 'flows', count(distinct user_id) from flows
union all
select 'agenda', count(distinct user_id) from agenda
union all
select 'issuers', count(distinct user_id) from issuers
union all
select 'advisor_settings', count(distinct user_id) from advisor_settings
union all
select 'tenencias_snapshots', count(distinct user_id) from tenencias_snapshots;

-- 3) Tu user_id real (para comparar con el que usás al armar los
--    curls de prueba y con el que aparece en 002_verify.sh).
select id, email from auth.users;
