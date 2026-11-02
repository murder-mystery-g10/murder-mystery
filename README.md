# Murder Mystery

A multiplayer murder mystery game that runs in the browser. Players explore the rooms of a
manor, collect clues, put them on a shared board and question suspects played by AI. The team
wins by naming the culprit, the motive and the method.


## Local vs. server: where you work

If you have not worked on a project like this before, read this section first.

You work on **your own laptop** almost all the time. You run the whole app there, change the
code, and see the result right away.

There is also a **shared server**: a virtual machine (VM) in Azure, a computer in the cloud that
the whole team can reach at
https://murder-mystery-g10.polandcentral.cloudapp.azure.com. It is only for the common version
of the project: checking work after it was merged, testing with the whole team, and demos.

Your laptop and the server are not connected:

- The server only runs code that was **merged** into `main`, the main branch of the repository.
  To merge means to add the changes from a pull request to `main`.
- After every merge the server updates itself. Nobody copies files to it by hand.
- You never start the server to test your own changes. Test them on your laptop.

### Three situations

| I want to… | Do this | Open |
|---|---|---|
| A. check that everything works | `docker compose up --build` | http://localhost:8080 |
| B. work on one part (frontend, backend or AI) | Run your part directly on your laptop, everything else in Docker (see below) | depends on the part |
| C. see the common version that everyone merged | GitHub → **Actions → Server → Run workflow → start** | https://murder-mystery-g10.polandcentral.cloudapp.azure.com |

[Docker](https://www.docker.com/) runs each part of the app in a **container**: an isolated
mini-computer with everything that part needs already installed. An **image** is the recipe a
container starts from. You don't need to install Python, Node or Postgres to run the app; Docker
brings them.

### Example: a frontend work session

At the start of the session, open two terminals in the project folder.

```bash
# Terminal 1: start everything except the frontend, in Docker
docker compose up postgres ai-service backend

# Terminal 2: start the frontend on your laptop
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. From now on you only edit and save files. The browser updates by
itself a moment later: this is called **hot reload**. You don't run anything again after each
change. When you are done, press `Ctrl+C` in both terminals.

### What to start for each part

| I work on | Start in Docker | Start on my laptop | Test at |
|---|---|---|---|
| Frontend | `docker compose up postgres ai-service backend` | `npm run dev` in `frontend/` | http://localhost:5173 |
| Backend | `docker compose up postgres ai-service` | the backend with `uvicorn` | http://localhost:8000/api/docs |
| AI service | nothing | the AI service with `uvicorn` | http://localhost:8001/docs |

The exact commands are in [docs/development.md](docs/development.md#3-work-on-one-part-with-hot-reload).

How the parts find each other: each container publishes a **port** on your laptop. A port is a
numbered door through which a program receives connections (`localhost:8000` means "port 8000 on
this computer"). So a backend running on your laptop reaches the database in Docker at
`localhost:5432`, and the frontend dev server reaches the backend at `localhost:8000`, whether
the backend runs in Docker or not.

### How your code gets to the server

```
your laptop → git push → pull request → CI green + review → merge into main → server updates itself
```

- A **pull request (PR)** asks the team to merge your branch into `main`.
- **CI** (continuous integration) runs the tests and checks on every PR automatically, in
  GitHub Actions. Green means everything passed.
- The update of the server after a merge is the **deploy**. It takes about 3–4 minutes.

### When the server runs

The server is off most of the time, because it is paid per running hour from a limited Azure
for Students credit. Start it when you need it (situation C above). It stops by itself after 30
minutes without use, 3 hours after it was started, and at night (01:00–07:00, Romania time).
Details: [docs/shared-server.md](docs/shared-server.md).

## What you need

- [Git](https://git-scm.com/) and [Docker](https://www.docker.com/products/docker-desktop/):
  everyone.
- [uv](https://docs.astral.sh/uv/): only if you work on the backend, the AI service or the
  contracts (Python).
- [Node 24](https://nodejs.org/): only if you work on the frontend.

Installation steps for Windows, macOS and Linux:
[docs/development.md](docs/development.md#1-install-the-tools).

## Quick start

```bash
git clone git@github.com:murder-mystery-g10/murder-mystery.git
cd murder-mystery
cp .env.example .env          # Windows PowerShell: copy .env.example .env
docker compose up --build
```

The first start takes a few minutes while Docker builds the images. Then open
http://localhost:8080: you should see four green **OK**s (backend, database, AI service,
Socket.IO). Stop with `Ctrl+C`.

## Repository layout

| Folder | Contents |
|---|---|
| `backend/` | Game server: FastAPI + Socket.IO, game engine, Postgres |
| `ai-service/` | Internal AI service: interrogation, case generation, validation |
| `frontend/` | Browser app: React + TypeScript + Vite |
| `shared/schemas/` | Pydantic models shared by all services (the contracts) |
| `themes/conac/` | Manor theme: map and room images |
| `cases/` | Library of validated cases |
| `tools/` | Developer tools (clickable-zone editor) |
| `docs/` | Documentation; `docs/contracts/` holds the contracts between teams |
| `infra/azure/` | Scripts that create and configure the shared server |
| `deploy/` | Production config copied to the server (Caddy) |

## Documentation

| Document | For | What it covers |
|---|---|---|
| [docs/development.md](docs/development.md) | everyone | Installing the tools, running the project, tests, daily workflow |
| [docs/shared-server.md](docs/shared-server.md) | everyone | Starting and stopping the server, deploys, logs, demo versions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | everyone | Branches, commit messages, pull requests, language rules |
| [docs/contracts/](docs/contracts/README.md) | everyone | Case schema, theme map, APIs and Socket.IO events between teams |
| [docs/case-design.md](docs/case-design.md) | AI team, case authors | Rules and checklist for a fair case |
| [docs/server-admin.md](docs/server-admin.md) | server admins only | Azure resources, secrets, backups, rebuilding the server |
