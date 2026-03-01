#!/usr/bin/env bash
# =============================================================================
# apply-infra.sh — Generate HAProxy + Nginx configs from config.env + templates
# Usage: scripts/apply-infra.sh [--output-dir /etc]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$ROOT_DIR/config.env"
INFRA_DIR="$ROOT_DIR/infra"
OUTPUT_DIR="${1:-$INFRA_DIR}"

# Load config.env
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: $CONFIG_FILE not found. Copy config.env and fill in values."
  exit 1
fi
set -a
source "$CONFIG_FILE"
set +a

echo "Applying config from: $CONFIG_FILE"
echo "Output directory:     $OUTPUT_DIR"

# Generate nginx.conf
envsubst '${PORT_NGINX}' \
  < "$INFRA_DIR/nginx.conf.template" \
  > "$OUTPUT_DIR/nginx.conf"
echo "  ✓ nginx.conf          (port: $PORT_NGINX)"

# Generate haproxy.cfg
envsubst '${PORT_HAPROXY} ${PORT_NGINX} ${PORT_BACKEND} ${PORT_HAPROXY_STATS} ${HAPROXY_TLS_CERT} ${HAPROXY_STATS_PASSWORD}' \
  < "$INFRA_DIR/haproxy.cfg.template" \
  > "$OUTPUT_DIR/haproxy.cfg"
echo "  ✓ haproxy.cfg         (public: $PORT_HAPROXY, nginx: $PORT_NGINX, backend: $PORT_BACKEND)"

# Generate systemd EnvironmentFile for the backend service
cat > "$OUTPUT_DIR/backend.env" <<EOF
PORT_BACKEND=${PORT_BACKEND}
PORT_POSTGRES=${PORT_POSTGRES}
DB_HOST=${DB_HOST}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION_MS=${JWT_EXPIRATION_MS}
PFSENSE_BASE_URL=${PFSENSE_BASE_URL}
PFSENSE_API_KEY=${PFSENSE_API_KEY}
PFSENSE_TRUST_ALL_CERTS=${PFSENSE_TRUST_ALL_CERTS}
EOF
echo "  ✓ backend.env         (for systemd EnvironmentFile)"

echo ""
echo "Done. Deploy to system:"
echo "  sudo cp $OUTPUT_DIR/nginx.conf   /opt/hacksmc/nginx.conf"
echo "  sudo cp $OUTPUT_DIR/haproxy.cfg  /etc/haproxy/haproxy.cfg"
echo "  sudo cp $OUTPUT_DIR/backend.env  /etc/hacksmc/backend.env"
echo "  sudo systemctl reload nginx haproxy hacksmc-backend"
