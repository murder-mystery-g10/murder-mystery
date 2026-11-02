# Contracts

Contracts between teams. The Pydantic models in `shared/schemas` are the source of truth;
the JSON Schemas here are generated from them. Any change goes through a PR approved by both teams.

| File | Teams | Source |
|---|---|---|
| `case.schema.json` | AI + Backend | `shared_schemas.case.Case` |
| `theme-map.schema.json` | Frontend/UI/UX + AI | `shared_schemas.theme_map.ThemeMap` |
| `ai-api.schema.json` | AI + Backend | `shared_schemas.ai_api` |

After changing a model, regenerate the JSON Schemas and the TypeScript types and commit them with
your change: see [Changing a contract](../development.md#5-changing-a-contract). CI fails if they
are out of date.

## Case and map

The design rules a case must follow are in [case-design.md](../case-design.md).

- A case never reaches the browser; the frontend gets filtered views through the API.
- The theme map (`themes/<theme>/map.json`) is fixed per theme; a case refers to its room and object ids.
- Zones are polygons with coordinates in percent (0–100) of the room image.
- A suspect's interrogation sheet only contains the timeline events listed in their `witnessed_by`.
- Break triggers are OR-lists of AND-combinations of clue/testimony ids, accumulated across questions.

## AI service API

Internal; only the backend calls it, with the `X-Internal-Key` header. Interactive docs: http://localhost:8001/docs.

| Endpoint | Request | Response |
|---|---|---|
| `POST /interrogate` | `InterrogateRequest` | `InterrogateResponse` |
| `POST /generate` | `GenerateRequest` | `202` + `GenerationAccepted` |
| `GET /generate/{job_id}` | — | `GenerationJob` |
| `POST /validate` | `ValidateRequest` | `ValidationReport` |
| `GET /health` | — | `HealthResponse` (no key needed) |

- Stateless: `/interrogate` receives the whole case and the suspect id; the AI service builds
  the suspect sheet itself, filtered by `witnessed_by`.
- The backend decides breaking: it sends the reached `break_stage` and `just_broke`;
  the AI service only plays it out.
- The reply comes back whole; the frontend shows it letter by letter.
- Every reply carries the suspect's emotion (`calm`, `nervous`, `angry`, `sad`, `arrogant`,
  `broken`) and an intensity between 0 and 1. Emotion is not part of the case.
- If the AI service fails, the backend shows "Suspectul refuză să vorbească momentan"
  and does not consume the question.
- Theme maps for `/generate` and `/validate` are read from `themes/<theme>/map.json`.

## Game API (backend ↔ frontend)

| File | Contents |
|---|---|
| `game-api.schema.json` | REST bodies and every Socket.IO payload (`shared_schemas.game_api`) |
| `socket-events.md` | Table of all Socket.IO events — start here |
| `socket-events.json` | Same table, machine-readable (used to generate TypeScript) |

REST (interactive docs: http://localhost:8000/api/docs):

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/health` | — | `HealthResponse` |
| `GET /api/health/ready` | — | `ReadinessResponse` (`503` when the database or the AI service is down) |
| `POST /api/lobbies` | `CreateLobbyRequest` | `201` + `LobbySession` |
| `POST /api/lobbies/{code}/join` | `JoinLobbyRequest` | `LobbySession` |
| `GET /api/cases` | — | `CaseSummary[]` |
| `GET /api/themes/{theme_id}/map` | — | `ThemeMap` |

The frontend uses TypeScript types generated from these files (`frontend/src/contracts/`); see
[Changing a contract](../development.md#5-changing-a-contract).
