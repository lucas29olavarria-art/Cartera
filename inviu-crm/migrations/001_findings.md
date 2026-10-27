# Hallazgos del audit (000_audit.sql) — 27/oct/2026

Resultado de correr `000_audit.sql` en el proyecto `vqxcmooloynecpvyeghv` (el del CRM).
Conclusión: **no hace falta migrar RLS/políticas — ya están bien configuradas.** No se
corrió ninguna migración de esquema a partir de este audit.

## Lo que ya existía en las 6 tablas (`clients`, `flows`, `agenda`, `issuers`,
## `advisor_settings`, `tenencias_snapshots`)

- `rowsecurity = true` en las 6 (RLS habilitado).
- Columna `user_id uuid NOT NULL DEFAULT auth.uid()` en las 6.
- Políticas `PERMISSIVE` sobre el rol `public`, condición `auth.uid() = user_id`,
  cubriendo `ALL` (o cada comando por separado en `tenencias_snapshots`).
- `issuers` tiene PK compuesta `(ticker, user_id)` — único por usuario, correcto.
- `advisor_settings` tiene PK `(user_id)` — una fila por usuario, correcto.
- `anon` y `authenticated` tienen grants de tabla completos (SELECT/INSERT/UPDATE/
  DELETE/etc.) — esto es el default de Supabase y no es un problema por sí solo.

## Por qué esto ya cierra el acceso anónimo

Con la anon key y **sin sesión**, `auth.uid()` es `NULL`:
- `SELECT`: `NULL = user_id` nunca es `true` → devuelve `[]`.
- `INSERT`: `user_id` se autocompletaría con `auth.uid()` (`NULL`), pero la columna
  es `NOT NULL` → la base rechaza el insert antes de evaluar RLS.

Es decir: la anon key sola, sin login, no puede leer ni escribir nada en ninguna
de las 6 tablas. El problema real no era la base — era que el frontend podía
cargar datos sin forzar login (ya resuelto en el PASO 1, login OTP obligatorio
antes de llamar a `loadDBFromSupabase()`).

## Decisión sobre el nombre de columna

El plan original pedía `owner_id`; la base ya usa `user_id`. Se decidió **dejar
`user_id`** — cero riesgo de tocar algo que funciona. Las migraciones futuras
del resto del ecosistema (Zafira/Nova/Midas/Chispa, tabla `agent_runs`, etc.)
deben usar `user_id`, no `owner_id`, para ser consistentes con esto.

## Lo que sí queda pendiente

1. **PASO 3** — verificar esto con un curl real (anon sin sesión → `[]`/401;
   con sesión → datos reales), no solo inferirlo de los catálogos.
2. **PASO 4** — `SECURITY.md` con lo que hay que confirmar a mano en el dashboard
   (esto el audit SQL no lo cubre): "Allow new users to sign up" desactivado,
   template de email de OTP mandando `{{ .Token }}`, Site URL / Redirect URLs.
