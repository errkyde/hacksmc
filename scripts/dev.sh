#!/usr/bin/env bash
# =============================================================================
# dev.sh — Start backend + frontend in development mode using config.env
# Usage: scripts/dev.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$ROOT_DIR/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: $CONFIG_FILE not found."
  exit 1
fi

set -a
source "$CONFIG_FILE"
set +a

echo "Starting HackSMC (dev mode)"
echo "  Backend  → http://localhost:${PORT_BACKEND}"
echo "  Frontend → http://localhost:${PORT_VITE_DEV}"
echo ""

# Start backend in background
(
  cd "$ROOT_DIR/backend"
  echo "[backend] Starting Spring Boot on port ${PORT_BACKEND}..."
  mvn spring-boot:run -q
) &
BACKEND_PID=$!

# Give backend a moment to start
sleep 3

# Start frontend
(
  cd "$ROOT_DIR/frontend"
  echo "[frontend] Starting Vite on port ${PORT_VITE_DEV}..."
  npm run dev
) &
FRONTEND_PID=$!

# Cleanup on exit
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
