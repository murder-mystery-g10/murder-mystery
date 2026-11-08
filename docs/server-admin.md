# Server administration

For the people who manage the Azure server. Everyone else only needs
[shared-server.md](shared-server.md).

All Azure commands below need the Azure CLI, logged in to the subscription that owns the
server (`az login`). SSH commands need the matching private keys (see [Access](#access)).

## Overview

```
Browser ──HTTPS──▶ Caddy ──▶ frontend (nginx) ──▶ /api, /socket.io ──▶ backend ──▶ ai-service
                     │                                                  │
                     └── /logs ──▶ Dozzle (password)                    └──▶ postgres ──▶ daily backup ──▶ Blob Storage
```

All containers run with Docker Compose on one Azure VM. Only Caddy publishes ports (80, 443).

| Resource | Name | Notes |
|---|---|---|
| Subscription | Azure for Students (UBB tenant) | The university's policies limit regions and VM sizes |
| Resource group | `murder-mystery-rg` | Holds everything below; deleting it removes the whole server |
| Region | `polandcentral` | |
| VM | `mm-server` | `Standard_B2s_v2` (2 vCPU, 8 GiB), Ubuntu 24.04, 64 GiB disk; ~0.10 USD per running hour |
| Public IP / DNS | `mm-server-ip` | `murder-mystery-g10.polandcentral.cloudapp.azure.com`, static |
| Firewall | `mm-server-nsg` + `ufw` on the VM | Ports 22, 80, 443 |
| VM identity | system-assigned | Can deallocate its own VM and write backups |
| GitHub identity | `mm-github-actions` | OIDC, only for the repo's `production` environment; can start/stop the VM |
| Backups | storage `mmg10backups`, container `postgres-backups` | Deleted after 14 days |
| Budget | `murder-mystery-monthly` | 20 per month, email alerts at 30/50/80/100% and on forecast |

Why only one VM size: the university's policy allows `Standard_B2s_v2` as the only size that is
also available to the subscription (in `polandcentral` and `swedencentral`). Smaller sizes are
either not offered or blocked.

## Access

| Who | User | Key | Can |
|---|---|---|---|
| Admins | `azureuser` | admin's own key (`~/.ssh/id_ed25519`) | everything, `sudo` |
| GitHub Actions | `deploy` | `~/.ssh/mm-deploy` (private key also in the `DEPLOY_SSH_KEY` secret) | Docker, `/opt/murder-mystery` |

SSH accepts keys only (no passwords), and `fail2ban` blocks repeated failed logins.

To give another admin access, add their public key on the server:

```bash
ssh azureuser@murder-mystery-g10.polandcentral.cloudapp.azure.com \
  "echo '<their public key>' >> ~/.ssh/authorized_keys"
```

### On the server

| Path | Contents |
|---|---|
| `/opt/murder-mystery/` | `docker-compose.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile` (copied by every deploy) |
| `/opt/murder-mystery/.env` | Server settings and passwords (only here, never in Git) |
| `/etc/default/idle-deallocate` | Auto-stop settings |
| `/etc/default/pg-backup` | Backup target |

```bash
cd /opt/murder-mystery
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$C ps                      # container status
$C logs -f backend         # logs of one service
$C restart backend
```

## GitHub configuration

Environment **`production`** (Settings → Environments), usable only from `main` and tags `v*`:

| Name | Kind | Value |
|---|---|---|
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | variables | printed by `infra/azure/github-access.sh` |
| `AZURE_RESOURCE_GROUP`, `AZURE_VM_NAME` | variables | `murder-mystery-rg`, `mm-server` |
| `SERVER_HOST` | variable | the DNS name |
| `SERVER_KNOWN_HOSTS` | variable | the server's SSH host keys (`ssh-keygen -F <host>` from a trusted `known_hosts`) |
| `DEPLOY_SSH_KEY` | secret | private key `~/.ssh/mm-deploy` |

Workflows: `ci.yml` (checks on every PR), `deploy.yml` (CI, then deploy, on `main` and `v*` tags),
`server.yml` (start/stop buttons, nightly stop). See
[What GitHub Actions does](shared-server.md#what-github-actions-does).

The GHCR packages (`ai-service`, `backend`, `frontend`) are public, so the server pulls them
without logging in.

## AI model

The model runs on Azure OpenAI, on a **second Azure for Students subscription** (owner: Ioan;
Contributor: David, Andrei), so it uses that subscription's credit, not the server's.

| | |
|---|---|
| Resource group | `murder-mystery-ai` (francecentral) |
| Resource | `mm-g10-openai`, endpoint `https://mm-g10-openai.openai.azure.com/openai/v1` |
| Deployments | `gpt-5-mini`, `gpt-4.1-mini` (Global Standard) |
| Budget | `murder-mystery-ai`, 15 USD per month, email alerts |

The server's `.env` sets the `AI_*` variables (see `.env.prod.example`) with `key2` of the
resource; `key1` is shared privately with the AI team for local work. If a key leaks, regenerate
only that one:

```bash
az account set --subscription <second subscription id>
az cognitiveservices account keys regenerate -g murder-mystery-ai -n mm-g10-openai --key-name key1
```

## Costs

Compute is billed only while the VM runs (~0.10 USD/hour, ~2.40 USD/day if left on). When
deallocated, only the disk and the static IP cost a few USD per month. The automatic stops keep
normal use well under the monthly budget of 20.

```bash
az consumption usage list --query "[].{date:date, cost:pretaxCost, resource:instanceName}" -o table
```

## Demo and test days

Disable the automatic stops (idle, 3 hours, night) for the day, and enable them again after:

```bash
ssh azureuser@murder-mystery-g10.polandcentral.cloudapp.azure.com "sudo touch /etc/idle-deallocate.disabled"
ssh azureuser@murder-mystery-g10.polandcentral.cloudapp.azure.com "sudo rm /etc/idle-deallocate.disabled"
```

The nightly **Server** workflow still stops the VM at 23:30 UTC (01:30 in winter, 02:30 in
summer, Romania time). To skip it for one night, disable
the workflow in **Actions → Server → ⋯ → Disable workflow** and enable it again the next day.

Check the auto-stop decisions: `journalctl -t idle-deallocate --since today`.

## Backups

A systemd timer dumps the database every day at 12:00 UTC, or at the next start if the VM was
off. Dumps go to `mmg10backups/postgres-backups/postgres/<timestamp>.dump` and are deleted
after 14 days.

```bash
# List backups
az storage blob list --account-name mmg10backups -c postgres-backups --auth-mode login -o table

# Run a backup now
ssh azureuser@murder-mystery-g10.polandcentral.cloudapp.azure.com \
  "sudo systemctl start pg-backup.service; sudo journalctl -u pg-backup -n 3 --no-pager"
```

### Restore

This replaces the current database with the backup.

```bash
HOST=murder-mystery-g10.polandcentral.cloudapp.azure.com
NAME=postgres/2026-11-02T0910Z.dump      # from the list above

az storage blob download --account-name mmg10backups -c postgres-backups --auth-mode login \
  -n "$NAME" -f backup.dump
scp -i ~/.ssh/mm-deploy backup.dump deploy@$HOST:/tmp/backup.dump
ssh -i ~/.ssh/mm-deploy deploy@$HOST '
  set -e
  cd /opt/murder-mystery
  C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
  $C stop backend
  $C exec -T postgres sh -c "pg_restore -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --clean --if-exists --no-owner" < /tmp/backup.dump
  $C start backend
  rm /tmp/backup.dump'
```

## Maintenance tasks

| Task | How |
|---|---|
| New password for the logs page | `./infra/azure/server-env.sh --reset-logs-password` (prints it once) |
| Apply a change to `bootstrap.sh` | Re-run it (command at the top of the script); it is safe to repeat |
| Rotate the deploy key | `ssh-keygen -t ed25519 -N "" -f ~/.ssh/mm-deploy` (overwrite), re-run `bootstrap.sh`, then `gh secret set DEPLOY_SSH_KEY --env production < ~/.ssh/mm-deploy` |
| Redeploy without a code change | **Actions → Deploy → Run workflow** on `main` |
| OS updates | Security updates install automatically; for the rest, `sudo apt-get upgrade` and reboot |
| Server host key changed (VM rebuilt) | Update `SERVER_KNOWN_HOSTS` |

## Rebuilding the server

Use this to recreate the server from scratch, on the same or another subscription. Every
script is safe to re-run and reads its settings from variables at the top (override them in the
environment, e.g. `LOCATION=swedencentral`).

```bash
az login

# 1. Resource group, IP, firewall, VM (DNS_LABEL must be unique in the region)
DNS_LABEL=murder-mystery-g10 ./infra/azure/create-vm.sh
HOST=murder-mystery-g10.polandcentral.cloudapp.azure.com
ssh azureuser@$HOST true          # accept and save the host key

# 2. Server setup (Docker, deploy user, firewall, auto-stop, backups)
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/.ssh/mm-deploy   # only if missing
ssh azureuser@$HOST "sudo DEPLOY_PUBKEY='$(cat ~/.ssh/mm-deploy.pub)' bash -s" < infra/azure/bootstrap.sh

# 3. Backup storage (STORAGE_ACCOUNT must be globally unique; keep it equal in bootstrap.sh)
./infra/azure/backup-storage.sh

# 4. Server .env with random passwords (prints the logs password once)
./infra/azure/server-env.sh

# 5. GitHub access (prints the three AZURE_* values) and the monthly budget
./infra/azure/github-access.sh
BUDGET_EMAIL=you@example.com ./infra/azure/budget.sh
```

Then update the `production` environment in GitHub (see [GitHub configuration](#github-configuration)):

```bash
R=murder-mystery-g10/murder-mystery
gh variable set AZURE_CLIENT_ID       --env production -R $R --body <value>
gh variable set AZURE_TENANT_ID       --env production -R $R --body <value>
gh variable set AZURE_SUBSCRIPTION_ID --env production -R $R --body <value>
gh variable set SERVER_HOST           --env production -R $R --body $HOST
ssh-keygen -F $HOST | grep -v '^#' | gh variable set SERVER_KNOWN_HOSTS --env production -R $R
gh secret set DEPLOY_SSH_KEY --env production -R $R < ~/.ssh/mm-deploy
```

Finally run **Actions → Deploy → Run workflow** on `main`. If the DNS name changed, also update
`DOMAIN` in the server's `.env` and the links in these docs.

Delete everything: `az group delete -n murder-mystery-rg --yes` (the budget is on the
subscription; remove it in the portal under Cost Management → Budgets).

## Troubleshooting

| Problem | Check |
|---|---|
| Deploy fails at **Azure login** | The `AZURE_*` variables, and that the federated credentials match the repo (`az identity federated-credential list -g murder-mystery-rg --identity-name mm-github-actions -o table`) |
| Deploy fails at **Set up SSH** | VM running? `SERVER_KNOWN_HOSTS` current? Deploy key matches `/home/deploy/.ssh/authorized_keys`? |
| Deploy fails at **Health check** | `/logs/` or `$C logs backend ai-service` on the server |
| Site shows a certificate error | `$C logs caddy`; Let's Encrypt needs ports 80 and 443 reachable |
| VM stopped unexpectedly | `journalctl -t idle-deallocate` (after the next start) |
| No backup today | `systemctl list-timers pg-backup.timer`, `journalctl -u pg-backup` |
| Budget alert received | `az consumption usage list` (see [Costs](#costs)); check the VM isn't stuck running |
