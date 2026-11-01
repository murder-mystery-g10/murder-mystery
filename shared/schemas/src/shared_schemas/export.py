"""Write the JSON Schemas of the contract models to docs/contracts/.

uv run python -m shared_schemas.export          # regenerate
uv run python -m shared_schemas.export --check  # exit 1 if out of date
"""

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from shared_schemas import ai_api
from shared_schemas.case import Case
from shared_schemas.theme_map import ThemeMap


def _group(title: str, models: list[type[BaseModel]]) -> dict[str, Any]:
    """One schema file holding several models under $defs."""
    _, schema = models_json_schema([(model, "validation") for model in models], title=title)
    return schema


SCHEMAS: dict[str, Callable[[], dict[str, Any]]] = {
    "case.schema.json": Case.model_json_schema,
    "theme-map.schema.json": ThemeMap.model_json_schema,
    "ai-api.schema.json": lambda: _group("AiApi", ai_api.MODELS),
}


def render(build: Callable[[], dict[str, Any]]) -> str:
    return json.dumps(build(), indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("docs/contracts"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    stale: list[str] = []
    for name, build in SCHEMAS.items():
        path = args.out / name
        content = render(build)
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
