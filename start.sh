#!/usr/bin/env bash
# =============================================================================
# start.sh — HackSMC starten (Dev-Modus)
# Voraussetzung: config.env mit den nötigen Umgebungsvariablen anlegen
#   cp config.env.example config.env  → dann Werte eintragen
# Aufruf: ./start.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "FEHLER: $CONFIG_FILE nicht gefunden."
  echo "Bitte anlegen:"
  echo ""
  echo "  DB_PASSWORD=..."
  echo "  JWT_SECRET=...          (mind. 32 Zeichen)"
  echo "  PFSENSE_API_KEY=..."
  echo "  PFSENSE_BASE_URL=https://pfsense.local"
  echo ""
  echo "und als $CONFIG_FILE speichern."
  exit 1
fi

set -a; source "$CONFIG_FILE"; set +a

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HackSMC — pfSense NAT Management Portal"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend   → http://localhost:3000"
echo "  Frontend  → http://localhost:5173"
echo "  Swagger   → http://localhost:3000/api/swagger-ui"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cleanup() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Backend
(cd "$ROOT_DIR/backend" && mvn spring-boot:run -q) &
BACKEND_PID=$!

# Frontend
(cd "$ROOT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

wait
