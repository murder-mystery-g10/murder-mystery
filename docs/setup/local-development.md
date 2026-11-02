# Local development

Everything runs in Docker, so the only hard requirement is Docker. Install uv and Node only for
the part of the project you work on.

## 1. Install the tools

| Tool | Needed for | Windows | macOS | Linux |
|---|---|---|---|---|
| Git | everyone | [Git for Windows](https://git-scm.com/download/win) | `xcode-select --install` | package manager |
| Docker | everyone | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL 2 backend) | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | [Docker Engine](https://docs.docker.com/engine/install/) + Compose plugin |
| uv | backend, AI service, schemas | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | same as macOS |
| Node 24 | frontend | [fnm](https://github.com/Schniz/fnm), then `fnm install 24` | `brew install fnm`, then `fnm install 24` | fnm, then `fnm install 24` |
| GitHub CLI (optional) | PRs from the terminal | `winget install GitHub.cli` | `brew install gh` | package manager |

uv installs the right Python (3.13, from `.python-version`) by itself. `frontend/.node-version`
pins Node 24; fnm switches to it automatically inside `frontend/` if you enable
`--use-on-cd` (see the fnm README).

Check that everything works:

```bash
docker run --rm hello-world
uv --version
node --version   # v24.x
```

**Editor:** VS Code is configured in `.vscode/`. Accept the recommended extensions when it asks
(Python, Ruff, ESLint, Prettier, EditorConfig, Vitest); files are then formatted on save.

**Line endings:** `.gitattributes` keeps every file with LF endings, also on Windows. You don't
need to change any Git setting.

## 2. Clone and run

```bash
git clone git@github.com:murder-mystery-g10/murder-mystery.git
cd murder-mystery
cp .env.example .env          # Windows PowerShell: copy .env.example .env
docker compose up --build
```

Open http://localhost:8080. The status page should show four green **OK**s (backend, database,
AI service, Socket.IO).

| Service | URL |
|---|---|
| App (frontend + proxy) | http://localhost:8080 |
| Backend API docs | http://localhost:8000/api/docs |
| AI service API docs | http://localhost:8001/docs |
| Postgres | `localhost:5432`, user/password/db from `.env` |

Stop with `Ctrl+C`. `docker compose down` removes the containers; `docker compose down -v` also
deletes the local database.

## 3. Work on one service with hot reload

Run the other services in Docker and yours directly on your machine. The commands are in the
[root README](../../README.md#working-on-one-service). In short:

- **Frontend:** `docker compose up postgres ai-service backend`, then `cd frontend && npm install && npm run dev`
  → http://localhost:5173 (proxies `/api` and `/socket.io` to the backend on port 8000).
- **Backend:** `docker compose up postgres ai-service`, then run uvicorn with `--reload` on port 8000.
- **AI service:** run uvicorn with `--reload` on port 8001.

If a port is already taken, stop the Docker container of the service you run yourself
(`docker compose stop backend`) or whatever else uses the port.

## 4. Tests and linting

The same checks run in CI on every pull request. Run them before you push.

```bash
# Python (from the repo root; tests run per package)
uv sync --all-packages
uv run ruff check . && uv run ruff format --check .
uv run pytest shared/schemas
uv run pytest ai-service
uv run pytest backend

# Frontend
cd frontend
npm run lint && npm run format:check && npm test && npm run build
```

`uv run ruff format .` and `npm run format` fix formatting automatically.

## 5. Changing a contract

The Pydantic models in `shared/schemas` are the source of truth for everything teams exchange.
After changing one, regenerate the JSON Schemas and the TypeScript types and commit them with
your change:

```bash
uv run python -m shared_schemas.export
cd frontend && npm run gen:contracts
```

CI fails if either is out of date. Contract changes need approval from both teams involved
(see [docs/contracts](../contracts/README.md)).

## 6. Daily workflow

1. Update `main`: `git checkout main && git pull`
2. Create a branch: `git checkout -b feat/short-description` (prefixes: `feat/`, `fix/`, `chore/`, `docs/`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/) messages, e.g.
   `feat(backend): add lobby creation`, `fix(frontend): keep socket alive on reload`
4. Push and open a pull request into `main`
5. Wait until CI is green (it starts a few seconds after the PR is opened) and get a review
6. Merge with **Squash and merge**. The merge deploys automatically to the shared server
   (see [shared-server.md](shared-server.md))

Write all code, comments, commit messages and docs in English. Only text shown to players
(UI, case content) is in Romanian.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop (Windows/macOS) or `sudo systemctl start docker` (Linux) |
| Status page shows the database as unavailable right after start | Wait a few seconds; the backend waits for Postgres and runs migrations first |
| Database errors after pulling new migrations | `docker compose up --build` (the backend runs `alembic upgrade head` on start) |
| Database is in a broken state | `docker compose down -v && docker compose up --build` (deletes local data) |
| `port is already allocated` | Another container or program uses the port; stop it or the conflicting compose service |
| CI fails on `src/contracts` or `docs/contracts` | Regenerate the contracts (section 5) and commit the result |
