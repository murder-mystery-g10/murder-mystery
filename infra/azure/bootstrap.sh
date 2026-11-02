#!/usr/bin/env bash
# Sets up the Murder Mystery server. Safe to re-run.
# Run from your laptop:
#   ssh azureuser@<fqdn> "sudo DEPLOY_PUBKEY='$(cat ~/.ssh/mm-deploy.pub)' bash -s" < infra/azure/bootstrap.sh
#
# Disable idle + 3h limits (demo / test days):  sudo touch /etc/idle-deallocate.disabled
# Re-enable auto-deallocate:                sudo rm /etc/idle-deallocate.disabled

set -euo pipefail

ADMIN_USER="${SUDO_USER:-azureuser}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/murder-mystery}"
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:?Set DEPLOY_PUBKEY to the public key GitHub Actions will use}"
IDLE_MINUTES="${IDLE_MINUTES:-30}"
BOOT_GRACE_MINUTES="${BOOT_GRACE_MINUTES:-15}"
MAX_UPTIME_MINUTES="${MAX_UPTIME_MINUTES:-180}"
NIGHT_START_HOUR="${NIGHT_START_HOUR:-1}"   # Romania time
NIGHT_END_HOUR="${NIGHT_END_HOUR:-7}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-mmg10backups}"     # must match backup-storage.sh
BACKUP_CONTAINER="${BACKUP_CONTAINER:-postgres-backups}"

log() { printf '\n==> %s\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

log "System packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl jq ufw fail2ban python3-systemd conntrack unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT

log "Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
DAEMON_JSON='{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}'
if [[ "$(cat /etc/docker/daemon.json 2>/dev/null)" != "$DAEMON_JSON" ]]; then
  echo "$DAEMON_JSON" > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker

log "Deploy user '$DEPLOY_USER'"
id "$DEPLOY_USER" &>/dev/null || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "$DEPLOY_PUBKEY" > "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

log "SSH hardening (keys only, users: $ADMIN_USER, $DEPLOY_USER)"
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $ADMIN_USER $DEPLOY_USER
EOF
sshd -t
systemctl reload ssh || systemctl restart ssh

log "fail2ban"
cat > /etc/fail2ban/jail.local <<'F2B'
[sshd]
enabled = true
backend = systemd
journalmatch = _SYSTEMD_UNIT=ssh.service + _COMM=sshd-session + _COMM=sshd
maxretry = 5
bantime = 1h
F2B
systemctl enable fail2ban
systemctl restart fail2ban

log "Firewall (ufw): 22, 80, 443"
# Note: Docker bypasses ufw for published ports. In production only Caddy publishes 80/443.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443
ufw --force enable

log "Idle detector: deallocate after $IDLE_MINUTES min without use"
cat > /etc/default/idle-deallocate <<EOF
IDLE_MINUTES=$IDLE_MINUTES
BOOT_GRACE_MINUTES=$BOOT_GRACE_MINUTES
MAX_UPTIME_MINUTES=$MAX_UPTIME_MINUTES
NIGHT_START_HOUR=$NIGHT_START_HOUR
NIGHT_END_HOUR=$NIGHT_END_HOUR
EOF

cat > /usr/local/bin/idle-deallocate <<'SCRIPT'
#!/usr/bin/env bash
# Deallocates this VM (stops billing for compute) when nobody has used it for a while.
# "Used" = an authenticated SSH session (people or deploys), or a web connection on 80/443
# that stays open between two checks (players' websockets; internet scanners don't).
set -euo pipefail
source /etc/default/idle-deallocate
STATE=/var/lib/idle-deallocate
mkdir -p "$STATE"
touch -a "$STATE/last-active"
mark_active() { touch "$STATE/last-active"; }
deallocate() {
  logger -t idle-deallocate "$1, deallocating"
  token=$(curl -fsS -H Metadata:true \
    "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
    | jq -r .access_token)
  rid=$(curl -fsS -H Metadata:true \
    "http://169.254.169.254/metadata/instance/compute/resourceId?api-version=2021-02-01&format=text")
  curl -fsS -X POST -H "Authorization: Bearer $token" -H "Content-Length: 0" \
    "https://management.azure.com${rid}/deallocate?api-version=2024-07-01"
  exit 0
}

if [[ -e /etc/idle-deallocate.disabled ]]; then mark_active; exit 0; fi

hour=$(TZ=Europe/Bucharest date +%-H)
if (( hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR )); then deallocate "night hours ($hour:00 Romania time)"; fi

uptime_s=$(cut -d. -f1 /proc/uptime)
if (( uptime_s < BOOT_GRACE_MINUTES * 60 )); then mark_active; exit 0; fi
if (( uptime_s >= MAX_UPTIME_MINUTES * 60 )); then deallocate "up for $(( uptime_s / 60 )) min, limit is $MAX_UPTIME_MINUTES"; fi

active=0

# Authenticated SSH sessions show up as "sshd: user@pts/N" or "sshd: user@notty".
if pgrep -f 'sshd.*: [^ ]+@(pts|notty)' >/dev/null; then active=1; fi

# Inbound web flows (to this VM's IP, port 80/443), as "src:sport>dport".
local_ip=$(ip -4 route get 1.1.1.1 | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')
current=$(
  { conntrack -L -p tcp --state ESTABLISHED 2>/dev/null || true; conntrack -L -p udp 2>/dev/null || true; } \
  | awk -v ip="$local_ip" '{
      src=""; dst=""; sport=""; dport="";
      for (i=1;i<=NF;i++) {
        if ($i ~ /^src=/   && src==""  ) src=substr($i,5);
        if ($i ~ /^dst=/   && dst==""  ) dst=substr($i,5);
        if ($i ~ /^sport=/ && sport=="") sport=substr($i,7);
        if ($i ~ /^dport=/ && dport=="") dport=substr($i,7);
      }
      if (dst==ip && (dport=="80" || dport=="443")) print src ":" sport ">" dport
    }' | sort -u
)
if [[ -n "$current" && -s "$STATE/flows" ]] && comm -12 <(echo "$current") "$STATE/flows" | grep -q .; then
  active=1
fi
echo "$current" > "$STATE/flows"

if (( active )); then mark_active; exit 0; fi

idle=$(( $(date +%s) - $(stat -c %Y "$STATE/last-active") ))
(( idle < IDLE_MINUTES * 60 )) && exit 0

deallocate "idle for $(( idle / 60 )) min"
SCRIPT
chmod 755 /usr/local/bin/idle-deallocate

cat > /etc/systemd/system/idle-deallocate.service <<'UNIT'
[Unit]
Description=Deallocate the VM when idle

[Service]
Type=oneshot
ExecStart=/usr/local/bin/idle-deallocate
UNIT

cat > /etc/systemd/system/idle-deallocate.timer <<'UNIT'
[Unit]
Description=Check every 5 minutes whether the VM is idle

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now idle-deallocate.timer

log "Daily Postgres backup to Azure Blob Storage ($STORAGE_ACCOUNT/$BACKUP_CONTAINER)"
cat > /etc/default/pg-backup <<EOF
STORAGE_ACCOUNT=$STORAGE_ACCOUNT
BACKUP_CONTAINER=$BACKUP_CONTAINER
EOF

cat > /usr/local/bin/pg-backup <<'SCRIPT'
#!/usr/bin/env bash
# Dumps the game database and uploads it to Azure Blob Storage with the VM's managed identity.
# Old backups are deleted by the storage lifecycle policy (infra/azure/backup-storage.sh).
set -euo pipefail
source /etc/default/pg-backup

cid=$(docker ps -q -f label=com.docker.compose.project=murder-mystery -f label=com.docker.compose.service=postgres)
if [[ -z "$cid" ]]; then echo "postgres is not running, nothing to back up"; exit 0; fi

# Check over TCP: during first init the temporary server listens only on the socket.
for _ in $(seq 60); do
  docker exec "$cid" sh -c 'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' && break
  sleep 2
done

dump=$(mktemp /var/tmp/pg-backup.XXXXXX)
trap 'rm -f "$dump"' EXIT
docker exec "$cid" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$dump"

name="postgres/$(date -u +%Y-%m-%dT%H%MZ).dump"
token=$(curl -fsS -H Metadata:true \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/" \
  | jq -r .access_token)
curl -fsS -X PUT -T "$dump" \
  -H "Authorization: Bearer $token" -H "x-ms-version: 2021-08-06" -H "x-ms-blob-type: BlockBlob" \
  "https://${STORAGE_ACCOUNT}.blob.core.windows.net/${BACKUP_CONTAINER}/${name}"
logger -t pg-backup "uploaded $name ($(stat -c %s "$dump") bytes)"
echo "uploaded $name"
SCRIPT
chmod 755 /usr/local/bin/pg-backup

cat > /etc/systemd/system/pg-backup.service <<'UNIT'
[Unit]
Description=Back up Postgres to Azure Blob Storage
After=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pg-backup
UNIT

cat > /etc/systemd/system/pg-backup.timer <<'UNIT'
[Unit]
Description=Daily Postgres backup (runs at next boot if the VM was off)

[Timer]
OnCalendar=*-*-* 12:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now pg-backup.timer

log "Done"
docker --version
docker compose version
