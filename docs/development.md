# Local development

This guide takes you from an empty laptop to a running project, step by step. For the big
picture (what runs where, when to use the shared server), read
[Local vs. server](../README.md#local-vs-server-where-you-work) in the README first.

Everything runs in Docker, so Git and Docker are the only tools everyone needs. Install uv and
Node only for the part of the project you work on.

## 1. Install the tools

| Tool | Needed for | Windows | macOS | Linux |
|---|---|---|---|---|
| Git | everyone | [Git for Windows](https://git-scm.com/download/win) | `xcode-select --install` | package manager |
| Docker | everyone | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL 2 backend) | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | [Docker Engine](https://docs.docker.com/engine/install/) + Compose plugin |
| uv | backend, AI service, contracts | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | same as macOS |
| Node 24 | frontend | [fnm](https://github.com/Schniz/fnm), then `fnm install 24` | `brew install fnm`, then `fnm install 24` | fnm, then `fnm install 24` |
| GitHub CLI (optional) | PRs and workflows from the terminal | `winget install GitHub.cli` | `brew install gh` | package manager |

- **uv** manages Python for you: it installs the right Python version (3.13, from
  `.python-version`) and the project's packages by itself.
- **fnm** manages Node versions. `frontend/.node-version` pins Node 24; fnm switches to it
  automatically inside `frontend/` if you enable `--use-on-cd` (see the fnm README).
- On Windows, start Docker Desktop once after installing it and leave it running.

Check that everything works (open a new terminal first, so it sees the new tools):

```bash
docker run --rm hello-world   # prints "Hello from Docker!"
uv --version                  # prints "uv 0.x.y"
node --version                # prints v24.x
```

**Editor:** VS Code is configured in `.vscode/`. Accept the recommended extensions when it asks
(Python, Ruff, ESLint, Prettier, EditorConfig, Vitest); files are then formatted on save.

**Line endings:** `.gitattributes` keeps every file with LF line endings, also on Windows. You
don't need to change any Git setting.

## 2. Get the code and run everything

```bash
git clone git@github.com:murder-mystery-g10/murder-mystery.git
cd murder-mystery
cp .env.example .env          # Windows PowerShell: copy .env.example .env
docker compose up --build
```

- `.env` holds local settings: database user and password, and the key the backend uses to call
  the AI service. The values from `.env.example` are fine for your laptop. Never commit `.env`.
- `docker compose up` starts all services described in `docker-compose.yml`. `--build` rebuilds
  the images first, so the containers run your current code.

The first start takes a few minutes. When the terminal stops scrolling, open
http://localhost:8080. The status page should show four green **OK**s: backend, database, AI
service and Socket.IO (the real-time connection the game uses).

| Service | URL |
|---|---|
| App (frontend + proxy) | http://localhost:8080 |
| Backend API docs | http://localhost:8000/api/docs |
| AI service API docs | http://localhost:8001/docs |
| Postgres | `localhost:5432`, user/password/database from `.env` |

Stop with `Ctrl+C`. `docker compose down` removes the containers; `docker compose down -v` also
deletes the local database.

## 3. Work on one part with hot reload

Rebuilding everything with Docker after each change is slow. Instead, run the part you work on
directly on your laptop, with **hot reload**: it restarts or refreshes by itself every time you
save a file. Everything else keeps running in Docker.

Start the commands below once per work session, each in its own terminal, and stop them with
`Ctrl+C` when you are done.

### Frontend

```bash
# Terminal 1
docker compose up postgres ai-service backend

# Terminal 2
cd frontend
npm install        # first time, and after package.json changes
npm run dev
```

You should see `Local: http://localhost:5173/`. Open it; the status page should show four
green OKs. The dev server forwards `/api` and `/socket.io` to the backend on
`http://localhost:8000`. To use another backend address, set `BACKEND_URL` before `npm run dev`.
To work on the lobby screens before the backend implements them, set `VITE_USE_MOCK=true` in
`.env` and restart `npm run dev`: the frontend then fakes the lobby API with local data and shows
a mock banner. Keep it `false` otherwise, so backend errors reach the screen.

### Backend

```bash
# Terminal 1
docker compose up postgres ai-service

# Terminal 2, from the repository root
uv sync --all-packages                         # first time, and after dependency changes
cd backend && uv run alembic upgrade head && cd ..
uv run --package backend uvicorn backend.main:create_app --factory --reload --port 8000
```

In Windows PowerShell 5, use `;` instead of `&&`:
`cd backend; uv run alembic upgrade head; cd ..`

- `alembic upgrade head` applies the database migrations: scripts that create or change the
  database tables. Run it again after pulling new migrations.
- You should see `Uvicorn running on http://127.0.0.1:8000`. Open
  http://localhost:8000/api/docs to try the API, or http://localhost:8000/api/health/ready to
  check that the backend reaches the database and the AI service.
- The backend reads `.env` from the repository root and uses the database and AI service
  published by Docker on `localhost:5432` and `localhost:8001`.

### AI service

The AI service needs nothing else running.

```bash
uv sync --all-packages                         # first time, and after dependency changes
uv run --package ai-service uvicorn ai_service.main:app --reload --port 8001
```

Open http://localhost:8001/docs. Every endpoint except `/health` needs the `X-Internal-Key`
header: in the docs page, fill it in with the `INTERNAL_API_KEY` value from `.env`
(`dev-internal-key` by default).

#### The AI model

The AI service calls a language model through `ai_service/providers.py`. Which one is set in
`.env` with the `AI_*` variables (all explained in `.env.example`):

- **Ollama** (default, free, runs on your laptop): install it from https://ollama.com, then
  `ollama pull gemma3:4b`. Slower and weaker in Romanian, but enough to try things.
- **Azure OpenAI** (what the server uses): ask the AI team for the key, then uncomment the Azure
  lines in `.env`.

Check that the model answers:

```bash
uv run --package ai-service python -m ai_service.check_provider "Where were you last night at 22:00?"
```

When the model fails or is too slow (`AI_TIMEOUT_SECONDS`, 20 by default), the AI service
answers `503` and the game shows that the suspect refuses to talk.

### If a port is already taken

You get `port is already allocated` or `address already in use` when two programs want the same
port, for example the backend container and your own backend. Stop the container of the service
you run yourself (`docker compose stop backend`), or close the other program.

## 4. Tests and linting

The same checks run in CI on every pull request. Run them before you push, so CI stays green.

```bash
# Python, from the repository root (tests run per package)
uv sync --all-packages
uv run ruff check . && uv run ruff format --check .
uv run pytest shared/schemas
uv run pytest ai-service
uv run pytest backend

# Frontend
cd frontend
npm run lint && npm run format:check && npm test && npm run build
```

- `ruff` and `eslint` (`npm run lint`) look for mistakes in the code; `ruff format` and Prettier
  (`npm run format:check`) check the formatting.
- To fix the formatting automatically: `uv run ruff format .` and `npm run format` (in
  `frontend/`).

## 5. Changing a contract

The contracts are the data formats the services exchange: the case, the theme map, the AI
service API, and the REST and Socket.IO messages between backend and frontend. The Pydantic
models in `shared/schemas` are the single source of truth. Two sets of files are generated from
them and committed:

- the JSON Schemas in `docs/contracts/`
- the TypeScript types in `frontend/src/contracts/`

After changing a model, regenerate both and commit them together with your change:

```bash
uv run python -m shared_schemas.export
cd frontend && npm run gen:contracts
```

Never edit the generated files by hand. CI fails if they are out of date. Contract changes need
approval from both teams involved; see [docs/contracts](contracts/README.md).

## 6. Daily workflow

The rules (branch names, commit messages, merging) are in
[CONTRIBUTING.md](../CONTRIBUTING.md). The steps:

1. Get the latest `main`:
   ```bash
   git checkout main
   git pull
   ```
2. Create a branch for your task: `git checkout -b feat/short-description`
3. Work and commit as often as you like:
   ```bash
   git add .
   git commit -m "feat(frontend): add lobby screen"
   ```
4. Push the branch: `git push -u origin feat/short-description`
5. On GitHub, open a pull request into `main` (GitHub shows a **Compare & pull request** button
   after the push).
6. Wait until CI is green (it starts a few seconds after the PR is opened) and get a review.
7. Merge with **Squash and merge**. The merge deploys automatically to the shared server (see
   [shared-server.md](shared-server.md)).

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop (Windows/macOS) or `sudo systemctl start docker` (Linux) |
| `permission denied` on the Docker socket (Linux) | `sudo usermod -aG docker $USER`, then log out and back in |
| `internal_api_key: Field required` | You have no `.env`; run `cp .env.example .env` in the repository root |
| Status page shows the database as unavailable right after start | Wait a few seconds; the backend waits for Postgres and runs migrations first |
| Database errors after pulling new migrations | `docker compose up --build` (the backend runs `alembic upgrade head` on start) |
| Database is in a broken state | `docker compose down -v && docker compose up --build` (deletes local data) |
| `port is already allocated` | Another container or program uses the port; see [If a port is already taken](#if-a-port-is-already-taken) |
| `npm` complains about the Node version | Run `node --version`; it must be v24. With fnm: `fnm use 24` |
| CI fails on `src/contracts` or `docs/contracts` | Regenerate the contracts ([section 5](#5-changing-a-contract)) and commit the result |
