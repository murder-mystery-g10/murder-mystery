# Murder Mystery

Browser-based multiplayer murder mystery game with AI-played suspects. University team project; MVP due November 15, 2026.

## Repository layout

| Folder | Contents |
|---|---|
| `backend/` | FastAPI + Socket.IO, game engine, Postgres |
| `ai-service/` | Internal AI service: interrogation, generation, validation |
| `frontend/` | React + TypeScript + Vite |
| `shared/schemas/` | Shared Pydantic models |
| `themes/conac/` | Theme map and room images |
| `cases/` | Validated cases |
| `tools/` | Clickable-zone editor, scripts |
| `docs/contracts/` | Contracts between teams |
| `docs/setup/` | Setup and server documentation |
| `infra/azure/` | Scripts that create and configure the shared server |
| `deploy/` | Production config copied to the server (Caddy) |

## Documentation

- [Local development](docs/setup/local-development.md): install the tools, run the project, daily workflow
- [Shared server](docs/setup/shared-server.md): https://murder-mystery-g10.polandcentral.cloudapp.azure.com, start/stop, deploys, logs
- [Server administration](docs/setup/server-admin.md): Azure, backups, rebuilding the server
- [Contracts](docs/contracts/README.md): case schema, theme map, APIs and Socket.IO events between teams

## Requirements

- Docker (Docker Desktop on Windows/macOS, Docker Engine on Linux)
- For working on Python services: [uv](https://docs.astral.sh/uv/)
- For working on the frontend: Node 24

## Running everything

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:8080 — the status page should show four green OKs.
Stop with `Ctrl+C`; `docker compose down -v` also wipes the database.

| Service | URL |
|---|---|
| App (frontend + proxy) | http://localhost:8080 |
| Backend API docs | http://localhost:8000/api/docs |
| AI service API docs | http://localhost:8001/docs |
| Postgres | localhost:5432 |

## Working on one service

Start the others with compose, run yours locally:

```bash
# Frontend: hot reload on http://localhost:5173 (proxies to the backend on :8000)
docker compose up postgres ai-service backend
cd frontend && npm install && npm run dev

# Backend
docker compose up postgres ai-service
uv sync --all-packages
cd backend && uv run alembic upgrade head && cd ..
uv run --package backend uvicorn backend.main:create_app --factory --reload --port 8000

# AI service
uv sync --all-packages
uv run --package ai-service uvicorn ai_service.main:app --reload --port 8001
```

## Tests and linting

Python tests run per package (not from the root):

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest shared/schemas
uv run pytest ai-service
uv run pytest backend
```

Frontend:

```bash
cd frontend
npm run lint && npm run format:check && npm test && npm run build
```
