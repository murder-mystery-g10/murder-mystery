# Contributing

The step-by-step workflow (pull, branch, push, pull request) is in
[docs/development.md](docs/development.md#6-daily-workflow). This page lists the rules.

## Branches

- Never commit directly to `main`. Every change goes through a pull request.
- Create one branch per task, from an up-to-date `main`, named `<type>/short-description`:
  `feat/lobby-screen`, `fix/socket-reconnect`, `docs/server-guide`.
- Types: `feat/` (new feature), `fix/` (bug fix), `chore/` (tooling, config, cleanup), `docs/`
  (documentation only).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): what changed`.

```
feat(backend): add lobby creation
fix(frontend): keep socket alive on reload
docs: explain the hot reload setup
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Scope (optional): the part you changed, e.g. `backend`, `frontend`, `ai-service`, `contracts`,
  `infra`.
- Write what the change does, in the imperative: "add", not "added" or "adds".

## Pull requests

- Open the pull request into `main` and describe what changed and how you tested it.
- CI must be green and a teammate must review it before you merge.
- Changes to the contracts (`shared/schemas`, `docs/contracts`) need approval from both teams
  involved; see [docs/contracts](docs/contracts/README.md).
- Merge with **Squash and merge**: the whole pull request becomes one commit on `main`, with the
  pull request title as its message. So give the pull request a Conventional Commits title too.
- Every merge into `main` deploys to the shared server
  ([docs/shared-server.md](docs/shared-server.md)), so only merge work that runs.

## Language

- Code, comments, commit messages, pull requests and documentation: English.
- Text shown to players (UI, case content): Romanian.
