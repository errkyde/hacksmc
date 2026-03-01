#!/usr/bin/env bash
# =============================================================================
# start.sh — HackSMC starten
#
# Beim ersten Aufruf wird interaktiv konfiguriert und in config.env gespeichert.
# Danach startet die App direkt ohne Nachfragen.
#
# Konfiguration zurücksetzen: ./start.sh --reconfigure
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/config.env"

# ── Reconfigure-Flag ──────────────────────────────────────────────────────────
for arg in "$@"; do
  if [[ "$arg" == "--reconfigure" ]]; then
    rm -f "$CONFIG_FILE"
    echo "Konfiguration zurückgesetzt."
  fi
done

# ── Erstmalige Konfiguration ──────────────────────────────────────────────────
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  HackSMC — Erstkonfiguration"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Welche Datenbank soll verwendet werden?"
  echo "  1) PostgreSQL  (Produktiv-Setup)"
  echo "  2) H2          (lokal, kein Server nötig)"
  echo ""
  read -rp "Auswahl [1/2]: " db_choice

  {
    if [[ "$db_choice" == "2" ]]; then
      echo "DB_MODE=h2"
      echo ""

      read -rp "JWT_SECRET (Enter für Zufallswert): " jwt_secret
      if [[ -z "$jwt_secret" ]]; then
        jwt_secret=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$' </dev/urandom | head -c 48)
      fi
      echo "JWT_SECRET=$jwt_secret"

      echo ""
      read -rp "pfSense Base-URL [https://pfsense.local]: " pfsense_url
      echo "PFSENSE_BASE_URL=${pfsense_url:-https://pfsense.local}"

      read -rp "pfSense API-Key  [leer = Dummy]: " pfsense_key
      echo "PFSENSE_API_KEY=${pfsense_key:-dummy-h2-dev-key}"

    else
      echo "DB_MODE=postgres"
      echo ""

      read -rp "DB_HOST          [localhost]: "    db_host
      echo "DB_HOST=${db_host:-localhost}"

      read -rp "DB_NAME          [hacksmc]: "      db_name
      echo "DB_NAME=${db_name:-hacksmc}"

      read -rp "DB_USER          [hacksmc]: "      db_user
      echo "DB_USER=${db_user:-hacksmc}"

      read -rsp "DB_PASSWORD: "                    db_password; echo
      echo "DB_PASSWORD=$db_password"

      echo ""
      read -rp "JWT_SECRET (Enter für Zufallswert): " jwt_secret
      if [[ -z "$jwt_secret" ]]; then
        jwt_secret=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$' </dev/urandom | head -c 48)
      fi
      echo "JWT_SECRET=$jwt_secret"

      echo ""
      read -rp "pfSense Base-URL [https://pfsense.local]: " pfsense_url
      echo "PFSENSE_BASE_URL=${pfsense_url:-https://pfsense.local}"

      read -rsp "pfSense API-Key: " pfsense_key; echo
      echo "PFSENSE_API_KEY=$pfsense_key"

      read -rp "pfSense TLS-Zertifikat ignorieren? [j/N]: " trust_certs
      [[ "$trust_certs" =~ ^[jJ]$ ]] && echo "PFSENSE_TRUST_ALL_CERTS=true" || echo "PFSENSE_TRUST_ALL_CERTS=false"
    fi
  } > "$CONFIG_FILE"

  echo ""
  echo "✓ Konfiguration gespeichert in config.env"
  echo "  (Zurücksetzen mit: ./start.sh --reconfigure)"
  echo ""
fi

# ── Konfiguration laden ───────────────────────────────────────────────────────
set -a; source "$CONFIG_FILE"; set +a

DB_MODE="${DB_MODE:-postgres}"

# H2: Defaults setzen falls nicht angegeben
if [[ "$DB_MODE" == "h2" ]]; then
  export JWT_SECRET="${JWT_SECRET:-hacksmc-h2-dev-secret-key-minimum-32-chars!}"
  export PFSENSE_API_KEY="${PFSENSE_API_KEY:-dummy-h2-dev-key}"
  SPRING_PROFILE="h2"
  DB_LABEL="H2 (lokal)"
else
  SPRING_PROFILE=""
  DB_LABEL="PostgreSQL"
fi

# ── Info ──────────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HackSMC — pfSense NAT Management Portal"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Datenbank → $DB_LABEL"
echo "  Backend   → http://localhost:3000"
echo "  Frontend  → http://localhost:5173"
echo "  Swagger   → http://localhost:3000/api/swagger-ui"
[[ "$DB_MODE" == "h2" ]] && echo "  H2-Konsole → http://localhost:3000/h2-console"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Backend ───────────────────────────────────────────────────────────────────
(
  cd "$ROOT_DIR/backend"
  if [[ -n "$SPRING_PROFILE" ]]; then
    mvn spring-boot:run -q -Dspring-boot.run.profiles="$SPRING_PROFILE"
  else
    mvn spring-boot:run -q
  fi
) &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
(cd "$ROOT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

wait
