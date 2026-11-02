#!/usr/bin/env bash
# Creates /opt/murder-mystery/.env on the server with random passwords (only if it is missing),
# or resets the password of the logs page (Dozzle). Run from your laptop.
#
#   ./infra/azure/server-env.sh                        # create .env, prints the logs password once
#   ./infra/azure/server-env.sh --reset-logs-password  # new logs password, prints it once
set -euo pipefail

HOST="${HOST:-murder-mystery-g10.polandcentral.cloudapp.azure.com}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/mm-deploy}"
MODE="${1:-create}"

ssh -i "$DEPLOY_KEY" "deploy@$HOST" "DOMAIN=$HOST MODE=$MODE bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/murder-mystery
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
new_logs_password() {
  LOGS_PASSWORD=$(openssl rand -base64 18)
  LOGS_HASH=$(docker run --rm caddy:2 caddy hash-password --plaintext "$LOGS_PASSWORD")
}

if [[ "$MODE" == "--reset-logs-password" ]]; then
  new_logs_password
  grep -v '^LOGS_PASSWORD_HASH=' .env > .env.new
  echo "LOGS_PASSWORD_HASH='$LOGS_HASH'" >> .env.new
  mv .env.new .env && chmod 600 .env
  $COMPOSE up -d --no-deps --force-recreate caddy
  echo "Logs page -> user: admin  password: $LOGS_PASSWORD"
  exit 0
fi

if [[ -f .env ]]; then echo ".env already exists, leaving it alone"; exit 0; fi
new_logs_password
umask 077
cat > .env <<ENV
DOMAIN=$DOMAIN
IMAGE_TAG=latest
POSTGRES_USER=murder
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=murder
INTERNAL_API_KEY=$(openssl rand -hex 32)
LOGS_USER=admin
LOGS_PASSWORD_HASH='$LOGS_HASH'
ENV
echo "Created .env. Logs page -> user: admin  password: $LOGS_PASSWORD"
REMOTE
