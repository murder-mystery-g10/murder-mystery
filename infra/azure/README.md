# Azure infrastructure

Scripts that create and configure the shared server. All are safe to re-run; settings are
variables at the top of each script. Full guide: [docs/server-admin.md](../../docs/server-admin.md).

| Script | Runs | Does |
|---|---|---|
| `create-vm.sh` | laptop | Resource group, static IP + DNS name, firewall rules, VM with its own identity |
| `bootstrap.sh` | on the VM, over SSH | Docker, deploy user, SSH hardening, fail2ban, ufw, automatic updates, auto-stop, daily backup |
| `backup-storage.sh` | laptop | Storage account for backups, 14-day retention, access roles |
| `server-env.sh` | laptop | The server's `.env` with random passwords; resets the logs password |
| `github-access.sh` | laptop | Identity GitHub Actions uses (OIDC) to start/stop the VM |
| `budget.sh` | laptop | Monthly budget with email alerts |
