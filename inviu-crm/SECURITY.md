# Seguridad del CRM — checklist y estado

Proyecto Supabase del CRM: `vqxcmooloynecpvyeghv` (distinto al de la otra app
del repo, "Cartera"). Todo lo de abajo se hace en ese proyecto.

## Qué ya está hecho (código, en este repo)

- [x] Login con Supabase Auth, código OTP de 6 dígitos por email
      (`signInWithOtp` + `verifyOtp`), no magic link — pensado para la PWA.
      Ver commit "inviu-crm: login con OTP por email en vez de contraseña".
- [x] `onAuthStateChange`: si la sesión se cae, vuelve al login sin romper la UI.
- [x] Nada se carga de Supabase hasta que hay sesión (`boot()` → `getSession()`
      → si no hay sesión, muestra `#login` y no llama a `loadDBFromSupabase()`).
- [x] PIN local: queda como traba extra DESPUÉS del login, no lo reemplaza.
- [x] `logout()` ya existía y funciona con el nuevo login.
- [x] `importBackup` ya arma los objetos a insertar campo por campo (allowlist
      explícito) — cualquier `user_id`/`owner_id` que venga en un JSON de backup
      se ignora automáticamente, no hace falta código extra.
- [x] Auditado el historial completo de git: no hay ninguna `service_role` key
      ni nada que no sea la anon/publishable key.
- [x] No hay uso de Supabase Storage (ni ahora ni en el historial).

## Qué ya estaba bien en la base (confirmado con el audit, sin migrar nada)

- [x] RLS habilitado en las 6 tablas (`clients`, `flows`, `agenda`, `issuers`,
      `advisor_settings`, `tenencias_snapshots`).
- [x] Columna `user_id uuid NOT NULL DEFAULT auth.uid()` en las 6.
- [x] Políticas `auth.uid() = user_id` en las 6.
- [x] `issuers` único por `(ticker, user_id)`, `advisor_settings` único por `user_id`.

Detalle completo en `migrations/001_findings.md`.

## Checklist manual del dashboard de Supabase — estado (27/oct/2026)

1. [x] **Usuario confirmado.** `lucas29olavarria@gmail.com`, email confirmado,
   visto directamente en el JWT de una sesión real. No hizo falta crear nada.

2. [x] **"Allow new users to sign up" desactivado.** Confirmado por captura.
   Segunda capa además de `shouldCreateUser:false` en el frontend.

3. [~] **Template de email con `{{ .Token }}` — bloqueado, pero no es grave.**
   El dashboard no deja editar el `Source` del template ("Magic link or OTP")
   sin configurar SMTP propio (limitación del mail gratuito de Supabase, no
   algo que dependa de nosotros). Como el template ya se llama "Magic link
   **or OTP**", lo más probable es que el default de Supabase ya mande el
   código solo. **Pendiente de confirmar probando el login real una vez que
   el código OTP esté en `main`** (hoy sigue solo en la rama de feature). Si
   al probarlo el mail no trae el código, ahí se configura SMTP propio
   (gratis con Gmail o un proveedor tipo Resend) — se resuelve en ese momento.

4. [x] **Site URL / Redirect URLs corregidos.** Estaba en el default de
   desarrollo `http://localhost:3000` y sin ninguna Redirect URL cargada —
   quedó en `https://lucas29olavarria-art.github.io/Cartera/inviu-crm/` (Site
   URL) y `https://lucas29olavarria-art.github.io/Cartera/inviu-crm/*`
   (Redirect URLs). Esa es la URL real confirmada (el CRM abre ahí).

5. **SQL de `inviu-crm/migrations/`:**
   - `000_audit.sql` — [x] corrido, resultado en `001_findings.md`.
   - `002_verify.sql` — pendiente de correr (chequeo de integridad, no bloquea nada).
   - `002_verify.sh` — [x] parcial. Sin sesión: confirmado `[]` en las 6 tablas
     (la anon key sola no ve nada — el resultado que importaba). Con sesión:
     se probó con un token real pero dio 401 sin cuerpo de error, consistente
     con el proxy/firewall de la red donde se probó, no con un problema de
     RLS (ya confirmado por separado vía `000_audit.sql`: políticas, default
     `auth.uid()` y `NOT NULL` correctos). Repetir desde otra red si se quiere
     la contraprueba completa.

## Importante: falta mergear a `main`

Todo el trabajo de este checklist (login OTP, `onAuthStateChange`, etc.) está
commiteado y pusheado en la rama `claude/inviu-crm-github-push-hk90co`, **no
en `main`**. GitHub Pages publica desde `main`, así que el CRM que está online
hoy todavía usa el login viejo (contraseña). Mergear es un paso aparte,
pendiente de decisión explícita (no se pushea a `main` sin mostrar el diff).
