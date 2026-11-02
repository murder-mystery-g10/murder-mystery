# workflows

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` | every pull request and push to `main` | Python lint + tests, frontend lint + tests + build, contracts up to date, Docker builds |
| `deploy.yml` | push to `main`, tags `v*`, manual | Builds and pushes images to GHCR, deploys them to the shared server, checks health |
| `server.yml` | manual (start/stop), nightly at 23:30 UTC (stop) | Starts or stops the shared server |

`deploy.yml` and `server.yml` use the `production` environment, which only `main` and `v*` tags
can use. See [docs/setup/shared-server.md](../../docs/setup/shared-server.md) and
[docs/setup/server-admin.md](../../docs/setup/server-admin.md).
