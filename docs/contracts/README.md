# contracts

Contracts between teams. The Pydantic models in `shared/schemas` are the source of truth;
the JSON Schemas here are generated from them. Any change goes through a PR approved by both teams.

| File | Teams | Source |
|---|---|---|
| `case.schema.json` | AI + Backend | `shared_schemas.case.Case` |
| `theme-map.schema.json` | Frontend/UI/UX + AI | `shared_schemas.theme_map.ThemeMap` |

After changing a model, regenerate and commit the schemas:

```bash
uv run python -m shared_schemas.export
```

CI fails if they are out of date.

Key rules:

- A case never reaches the browser; the frontend gets filtered views through the API.
- The theme map (`themes/<theme>/map.json`) is fixed per theme; a case refers to its room and object ids.
- Zones are polygons with coordinates in percent (0–100) of the room image.
- A suspect's interrogation sheet only contains the timeline events listed in their `witnessed_by`.
- Break triggers are OR-lists of AND-combinations of clue/testimony ids, accumulated across questions.
- The suspect's emotion is not part of the case; it comes with every `/interrogate` reply.
