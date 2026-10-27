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

## Lo que falta hacer a mano en el dashboard de Supabase, EN ESTE ORDEN

1. **Confirmar/crear tu usuario.**
   `Authentication → Users`. Como la app ya pedía login con contraseña antes de
   este cambio, probablemente ya existe un usuario tuyo ahí — confirmá el email
   exacto. Si no existe ninguno, `Add user` y creá uno con tu email (no hace
   falta que tenga contraseña: el login OTP funciona igual para logins
   passwordless sobre un usuario existente).

2. **Desactivar altas de usuarios nuevos.**
   `Authentication → Settings` (o `Authentication → Providers → Email` según
   la versión del dashboard) → apagar **"Allow new users to sign up"**.
   Esto es la segunda capa: aunque alguien mande un OTP a otro email, el
   código `shouldCreateUser:false` del frontend ya lo bloquea, pero esto lo
   refuerza a nivel proyecto.

3. **Template de email para que mande el código, no el link.**
   `Authentication → Email Templates → Magic Link`. Ese mismo template sirve
   para el flujo OTP — asegurate de que el cuerpo incluya `{{ .Token }}`
   (el código de 6 dígitos), no solo `{{ .ConfirmationURL }}`. Si el template
   por defecto solo tiene el link, agregale una línea tipo:
   `Tu código es: {{ .Token }}`.

4. **Site URL / Redirect URLs.**
   `Authentication → URL Configuration`. Poné el **Site URL** apuntando a
   donde vive el CRM (`https://lucas29olavarria-art.github.io/Cartera/inviu-crm/`
   — confirmá primero que esa ruta sea la real, ver nota abajo). Agregá esa
   misma URL a **Redirect URLs**. Con el flujo de código OTP esto importa
   menos que con magic link, pero déjalo bien configurado igual por las dudas
   de que el template conserve el link como fallback.

5. **Correr los SQL de `inviu-crm/migrations/`, en este orden:**
   - `000_audit.sql` — ✅ ya corrido, resultado documentado en `001_findings.md`.
   - `001_findings.md` — es documentación, no se corre.
   - `002_verify.sql` — correr en el SQL Editor, solo chequea integridad de
     datos (no hay filas con `user_id` nulo, todo pertenece a un solo usuario).
   - `002_verify.sh` — correr desde una terminal (no es SQL). Primero sin
     nada (prueba que la anon key sola devuelve `[]`), después con
     `ACCESS_TOKEN='...'` de una sesión real logueada (prueba que ahí sí
     aparecen tus datos). Instrucciones de cómo sacar el token están arriba
     del script.

## Nota pendiente de confirmar

No pude verificar desde esta sesión si `inviu-crm/index.html` está realmente
publicado en `https://lucas29olavarria-art.github.io/Cartera/inviu-crm/` (el
proxy de red de este entorno no llega a `github.io`). Confirmalo vos en el
navegador antes del paso 4 de arriba, y si la URL real es otra, usá esa.
