"""Theme maps: rooms, clickable objects and doors, read from themes/<theme_id>/map.json."""

import re
from pathlib import Path

from shared_schemas import ThemeMap

# Letters, digits, '_' and '-' only: a theme id is a folder name, never a path.
THEME_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


def load_theme_map(themes_dir: Path, theme_id: str) -> ThemeMap | None:
    """The theme's map, or None when there is no such theme or it has no map.json yet.

    Raises pydantic.ValidationError when map.json does not follow the theme map schema.
    """
    if not THEME_ID.fullmatch(theme_id):
        return None
    path = themes_dir / theme_id / "map.json"
    if not path.is_file():
        return None
    return ThemeMap.model_validate_json(path.read_bytes())
