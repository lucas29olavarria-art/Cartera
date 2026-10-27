#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# 002_verify.sh — Prueba real contra la API REST de Supabase
#
# Esto es lo único que prueba de verdad si la anon key sola (sin login)
# puede leer tus datos. El SQL Editor de Supabase no sirve para esto
# porque corre con privilegios que bypassean RLS.
#
# Uso:
#   1) Corré esto tal cual, sin tocar nada, para la Parte 1 (sin sesión).
#   2) Para la Parte 2 (con sesión), necesitás un access_token real:
#        - Abrí el CRM en el navegador y logueate con el código OTP.
#        - DevTools → Application/Storage → Local Storage → tu dominio.
#        - Buscá la clave que empieza con "sb-...-auth-token" y copiá
#          el valor de "access_token" de adentro (es un JWT largo).
#      Pasalo como variable de entorno:
#        ACCESS_TOKEN='eyJ...' ./002_verify.sh
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

SUPABASE_URL="https://vqxcmooloynecpvyeghv.supabase.co"
ANON_KEY="sb_publishable_DBhPfwrGlvI-41Cmo2NfKQ_WYdoGnT5"
TABLES=(clients flows agenda issuers advisor_settings tenencias_snapshots)

echo "════════════════════════════════════════════════════"
echo "PARTE 1 — anon key SIN sesión (esto es lo que ve cualquiera"
echo "que abra tu página y copie la key del código fuente)"
echo "Esperado: [] o 0 filas en las 6 tablas. Si ves datos reales,"
echo "FRENÁ y avisame."
echo "════════════════════════════════════════════════════"
for t in "${TABLES[@]}"; do
  echo "--- $t ---"
  code=$(curl -s -o /tmp/verify_out.json -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/$t?select=*" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY")
  echo "HTTP $code — body: $(cat /tmp/verify_out.json)"
done

echo
echo "════════════════════════════════════════════════════"
echo "PARTE 2 — con sesión real (ACCESS_TOKEN)"
echo "Esperado: tus datos reales en las 6 tablas."
echo "════════════════════════════════════════════════════"
if [ -z "${ACCESS_TOKEN:-}" ]; then
  echo "No pasaste ACCESS_TOKEN — salteando la Parte 2."
  echo "Para correrla: ACCESS_TOKEN='eyJ...' ./002_verify.sh"
  exit 0
fi
for t in "${TABLES[@]}"; do
  echo "--- $t ---"
  code=$(curl -s -o /tmp/verify_out.json -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/$t?select=*" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  echo "HTTP $code — body: $(cat /tmp/verify_out.json)"
done
rm -f /tmp/verify_out.json
