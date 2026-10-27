# Seguridad del CRM — checklist y estado

Proyecto Supabase del CRM: `vqxcmooloynecpvyeghv` (distinto al de la otra app
del repo, "Cartera"). Todo lo de abajo se hace en ese proyecto.

## Qué ya está hecho (código, en este repo)

- [x] Login con Supabase Auth, código OTP por email (el proyecto manda 8
      dígitos, no 6 — el frontend ya no asume una longitud fija)
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

3. [x] **SMTP propio configurado (Gmail) + template con `{{ .Token }}`.**
   El default de Supabase sin SMTP propio solo mandaba el link (no el
   código), y el link daba 404. Se configuró SMTP con Gmail (contraseña de
   aplicación) y se editó el `Source` de "Magic link or OTP" para incluir
   `{{ .Token }}`. **Ojo:** el proyecto genera códigos de **8 dígitos**, no 6
   — el frontend tenía `maxlength="6"` y cortaba el código, arreglado en el
   commit "el código OTP puede tener más de 6 dígitos".

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

## Estado final — PASO 0 cerrado (27/oct/2026)

Mergeado a `main` y probado de punta a punta en producción: login con código
OTP real, recibido por mail, verificado contra Supabase, entrada al CRM
confirmada. La anon key sola (sin sesión) confirmado que no devuelve datos
en ninguna de las 6 tablas. No quedan pendientes de este checklist.

Nota de hábito: la contraseña vieja de `lucas29olavarria@gmail.com` en
Supabase (usada una vez como workaround de emergencia durante esta migración)
quedó visible en el historial de este chat — conviene no reusarla en otro
lado si se reusaba antes.
