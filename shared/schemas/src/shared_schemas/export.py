"""Write the contract files to docs/contracts/.

uv run python -m shared_schemas.export          # regenerate
uv run python -m shared_schemas.export --check  # exit 1 if out of date
"""

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path

from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from shared_schemas import ai_api, game_api
from shared_schemas.case import Case
from shared_schemas.theme_map import ThemeMap


def _json(data: object) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def _group(title: str, models: list[type[BaseModel]]) -> str:
    """One schema file holding several models under $defs."""
    _, schema = models_json_schema([(model, "validation") for model in models], title=title)
    return _json(schema)


OUTPUTS: dict[str, Callable[[], str]] = {
    "case.schema.json": lambda: _json(Case.model_json_schema()),
    "theme-map.schema.json": lambda: _json(ThemeMap.model_json_schema()),
    "ai-api.schema.json": lambda: _group("AiApi", ai_api.MODELS),
    "game-api.schema.json": lambda: _group("GameApi", game_api.MODELS),
    "socket-events.json": lambda: _json(game_api.socket_events_manifest()),
    "socket-events.md": game_api.socket_events_markdown,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("docs/contracts"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    stale: list[str] = []
    for name, render in OUTPUTS.items():
        path = args.out / name
        content = render()
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path))
        else:
            path.write_text(content, encoding="utf-8")
            print(f"wrote {path}")

    if stale:
        print("Out of date, run: uv run python -m shared_schemas.export", *stale, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
