"""Write the JSON Schemas of the contract models to docs/contracts/.

uv run python -m shared_schemas.export          # regenerate
uv run python -m shared_schemas.export --check  # exit 1 if out of date
"""

import argparse
import json
import sys
from pathlib import Path

from pydantic import BaseModel

from shared_schemas.case import Case
from shared_schemas.theme_map import ThemeMap

SCHEMAS: dict[str, type[BaseModel]] = {
    "case.schema.json": Case,
    "theme-map.schema.json": ThemeMap,
}


def render(model: type[BaseModel]) -> str:
    return json.dumps(model.model_json_schema(), indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("docs/contracts"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    stale: list[str] = []
    for name, model in SCHEMAS.items():
        path = args.out / name
        content = render(model)
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
