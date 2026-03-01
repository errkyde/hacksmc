#!/usr/bin/env bash
# =============================================================================
# start.sh — HackSMC starten
#
# Aufruf:
#   ./start.sh          → PostgreSQL (erfordert config.env)
#   ./start.sh --h2     → H2 In-Memory (kein PostgreSQL nötig)
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/config.env"

# ── Argumente parsen ──────────────────────────────────────────────────────────
DB_MODE="postgres"
for arg in "$@"; do
  [[ "$arg" == "--h2" ]] && DB_MODE="h2"
done

# ── Konfiguration laden ───────────────────────────────────────────────────────
if [[ "$DB_MODE" == "h2" ]]; then
  # config.env optional — Fallback-Defaults werden im Profil gesetzt
  [[ -f "$CONFIG_FILE" ]] && { set -a; source "$CONFIG_FILE"; set +a; }
  export JWT_SECRET="${JWT_SECRET:-hacksmc-h2-dev-secret-key-minimum-32-chars!}"
  export PFSENSE_API_KEY="${PFSENSE_API_KEY:-dummy-h2-dev-key}"
  SPRING_PROFILE="h2"
  DB_LABEL="H2 In-Memory"
else
  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "FEHLER: $CONFIG_FILE nicht gefunden."
    echo ""
    echo "Datei anlegen mit:"
    echo "  DB_PASSWORD=..."
    echo "  JWT_SECRET=...          (mind. 32 Zeichen)"
    echo "  PFSENSE_API_KEY=..."
    echo "  PFSENSE_BASE_URL=https://pfsense.local"
    echo ""
    echo "Oder für schnellen Start ohne PostgreSQL: ./start.sh --h2"
    exit 1
  fi
  set -a; source "$CONFIG_FILE"; set +a
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
