#!/usr/bin/env bash
# =============================================================================
# start.sh — HackSMC starten oder deployen
#
# Beim Start wird immer gefragt: Entwicklung oder Produktion? (+ DB-Wahl)
# Secrets (DB-Passwort, JWT, pfSense-Key) werden in config.env gespeichert.
#
# Secrets zurücksetzen: ./start.sh --reconfigure
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/config.env"

# ── Farben ────────────────────────────────────────────────────────────────────
C_BOLD='\033[1m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'
C_CYAN='\033[0;36m'; C_RESET='\033[0m'
info()    { echo -e "${C_CYAN}  →${C_RESET} $*"; }
success() { echo -e "${C_GREEN}  ✓${C_RESET} $*"; }
header()  { echo -e "\n${C_BOLD}$*${C_RESET}"; }

# ── Reconfigure-Flag ──────────────────────────────────────────────────────────
for arg in "$@"; do
  if [[ "$arg" == "--reconfigure" ]]; then
    rm -f "$CONFIG_FILE"
    echo "Konfiguration (Secrets) zurückgesetzt."
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# IMMER: Modus + Datenbank wählen
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
echo -e "${C_BOLD}  HackSMC — Start${C_RESET}"
echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
echo ""
echo "Wie soll HackSMC betrieben werden?"
echo "  1) Entwicklung  — Backend + Frontend direkt starten (kein Build)"
echo "  2) Produktion   — JAR bauen, systemd-Dienste einrichten & starten"
echo ""
read -rp "Auswahl [1/2]: " mode_choice
[[ "$mode_choice" == "2" ]] && RUN_MODE="prod" || RUN_MODE="dev"

if [[ "$RUN_MODE" == "dev" ]]; then
  echo ""
  echo "Welche Datenbank soll verwendet werden?"
  echo "  1) PostgreSQL  (vorhandener Server)"
  echo "  2) H2          (lokal, kein Server nötig)"
  echo ""
  read -rp "Auswahl [1/2]: " db_choice
  [[ "$db_choice" == "2" ]] && DB_MODE="h2" || DB_MODE="postgres"
else
  DB_MODE="postgres"
fi

# ═════════════════════════════════════════════════════════════════════════════
# SECRETS: nur beim ersten Mal (oder nach --reconfigure) abfragen
# ═════════════════════════════════════════════════════════════════════════════
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo ""
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}  Erstkonfiguration — Secrets${C_RESET}"
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"

  {
    # PostgreSQL-Zugangsdaten
    if [[ "$DB_MODE" == "postgres" ]] || [[ "$RUN_MODE" == "prod" ]]; then
      header "PostgreSQL"
      read -rp  "  DB_HOST      [localhost]: "  v; echo "DB_HOST=${v:-localhost}"
      read -rp  "  DB_PORT      [5432]:      "  v; echo "PORT_POSTGRES=${v:-5432}"
      read -rp  "  DB_NAME      [hacksmc]:   "  v; echo "DB_NAME=${v:-hacksmc}"
      read -rp  "  DB_USER      [hacksmc]:   "  v; echo "DB_USER=${v:-hacksmc}"
      read -rsp "  DB_PASSWORD: "               v; echo; echo "DB_PASSWORD=$v"
    fi

    # JWT
    echo ""
    header "JWT"
    read -rp "  JWT_SECRET (Enter = Zufallswert): " v
    if [[ -z "$v" ]]; then
      v=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$' </dev/urandom | head -c 48)
      echo "  → Generiert: $v" >&2
    fi
    echo "JWT_SECRET=$v"

    # pfSense
    echo ""
    header "pfSense"
    read -rp  "  Base-URL  [https://pfsense.local]: " v
    echo "PFSENSE_BASE_URL=${v:-https://pfsense.local}"
    read -rsp "  API-Key: " v; echo
    echo "PFSENSE_API_KEY=${v:-dummy-dev-key}"
    read -rp  "  TLS-Zertifikat ignorieren? [j/N]: " v
    [[ "$v" =~ ^[jJ]$ ]] && echo "PFSENSE_TRUST_ALL_CERTS=true" || echo "PFSENSE_TRUST_ALL_CERTS=false"

    # Ports + HAProxy (nur Produktion)
    if [[ "$RUN_MODE" == "prod" ]]; then
      echo ""
      header "Ports"
      read -rp "  Backend-Port   [3000]: " v; echo "PORT_BACKEND=${v:-3000}"
      read -rp "  Nginx-Port     [8080]: " v; echo "PORT_NGINX=${v:-8080}"
      read -rp "  HAProxy-Port   [443]:  " v; echo "PORT_HAPROXY=${v:-443}"
      read -rp "  Stats-Port     [9000]: " v; echo "PORT_HAPROXY_STATS=${v:-9000}"

      echo ""
      header "HAProxy TLS"
      read -rp  "  Pfad zum TLS-Zertifikat (.pem): " v
      echo "HAPROXY_TLS_CERT=${v:-/etc/ssl/hacksmc.pem}"
      read -rsp "  Stats-Passwort: " v; echo
      echo "HAPROXY_STATS_PASSWORD=${v:-changeme}"
    fi

    echo "JWT_EXPIRATION_MS=3600000"

  } > "$CONFIG_FILE"

  echo ""
  success "Secrets gespeichert → config.env"
  info    "Zurücksetzen mit: ./start.sh --reconfigure"
  echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# KONFIGURATION LADEN
# ═════════════════════════════════════════════════════════════════════════════
set -a; source "$CONFIG_FILE"; set +a

# H2-Defaults
if [[ "$DB_MODE" == "h2" ]]; then
  export JWT_SECRET="${JWT_SECRET:-hacksmc-h2-dev-secret-key-minimum-32-chars!}"
  export PFSENSE_API_KEY="${PFSENSE_API_KEY:-dummy-h2-dev-key}"
fi

# ═════════════════════════════════════════════════════════════════════════════
# ENTWICKLUNGS-MODUS
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$RUN_MODE" == "dev" ]]; then
  [[ "$DB_MODE" == "h2" ]] && DB_LABEL="H2 (lokal)" || DB_LABEL="PostgreSQL"

  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}  HackSMC — Entwicklungsmodus${C_RESET}"
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  info "Datenbank  → $DB_LABEL"
  info "Backend    → http://localhost:3000"
  info "Frontend   → http://localhost:5173"
  info "Swagger    → http://localhost:3000/api/swagger-ui"
  [[ "$DB_MODE" == "h2" ]] && info "H2-Konsole → http://localhost:3000/h2-console"
  echo ""

  cleanup() { echo ""; echo "Stopping..."; kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
  trap cleanup EXIT INT TERM

  (
    cd "$ROOT_DIR/backend"
    if [[ "$DB_MODE" == "h2" ]]; then
      mvn spring-boot:run -q -Dspring-boot.run.profiles=h2
    else
      mvn spring-boot:run -q
    fi
  ) &
  BACKEND_PID=$!

  (cd "$ROOT_DIR/frontend" && npm run dev) &
  FRONTEND_PID=$!

  wait
fi

# ═════════════════════════════════════════════════════════════════════════════
# PRODUKTIONS-MODUS
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$RUN_MODE" == "prod" ]]; then
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}  HackSMC — Produktions-Deployment${C_RESET}"
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo ""

  # 1. Backend bauen
  info "Backend bauen (mvn package)..."
  (cd "$ROOT_DIR/backend" && mvn package -DskipTests -q)
  success "Backend gebaut"

  # 2. Frontend bauen
  info "Frontend bauen (npm run build)..."
  (cd "$ROOT_DIR/frontend" && npm run build)
  success "Frontend gebaut"

  # 3. Verzeichnisse anlegen
  info "Verzeichnisse anlegen..."
  sudo mkdir -p /opt/hacksmc/{backend,logs}
  sudo mkdir -p /opt/hacksmc/frontend
  sudo mkdir -p /etc/hacksmc
  success "Verzeichnisse bereit"

  # 4. Artifacts kopieren
  info "Dateien kopieren..."
  sudo cp "$ROOT_DIR/backend/target/"hacksmc-backend-*.jar /opt/hacksmc/backend/hacksmc-backend.jar
  sudo cp -r "$ROOT_DIR/frontend/dist/." /opt/hacksmc/frontend/
  success "Artifacts kopiert"

  # 5. System-User anlegen (falls nicht vorhanden)
  if ! id hacksmc &>/dev/null; then
    info "System-User 'hacksmc' anlegen..."
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin hacksmc
    success "User 'hacksmc' angelegt"
  fi
  sudo chown -R hacksmc:hacksmc /opt/hacksmc

  # 6. Konfigurationen generieren
  info "Konfigurationen generieren..."
  TMP_DIR=$(mktemp -d)
  "$ROOT_DIR/scripts/apply-infra.sh" "$TMP_DIR"
  sudo cp "$TMP_DIR/backend.env" /etc/hacksmc/backend.env
  sudo cp "$TMP_DIR/nginx.conf"  /opt/hacksmc/nginx.conf
  sudo cp "$TMP_DIR/haproxy.cfg" /etc/haproxy/haproxy.cfg
  rm -rf "$TMP_DIR"
  success "Konfigurationen generiert"

  # 7. systemd-Services installieren
  info "systemd-Services installieren..."
  sudo cp "$ROOT_DIR/infra/systemd/hacksmc-backend.service"  /etc/systemd/system/
  sudo cp "$ROOT_DIR/infra/systemd/hacksmc-frontend.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable hacksmc-backend hacksmc-frontend
  success "Services installiert"

  # 8. Dienste (neu)starten
  info "Dienste starten..."
  sudo systemctl restart hacksmc-backend hacksmc-frontend
  sudo systemctl reload haproxy 2>/dev/null || sudo systemctl restart haproxy
  success "Dienste gestartet"

  echo ""
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  success "Deployment abgeschlossen"
  info "Erreichbar unter: https://$(hostname -f):${PORT_HAPROXY:-443}"
  info "Logs: sudo journalctl -u hacksmc-backend -f"
  echo ""
fi
