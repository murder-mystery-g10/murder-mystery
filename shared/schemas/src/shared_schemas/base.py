from collections.abc import Iterable
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class Schema(BaseModel):
    """Base class for every contract model.

    Unknown fields are rejected so that a typo or an out-of-date client
    fails loudly instead of being silently ignored.
    """

    model_config = ConfigDict(extra="forbid")


# Identifier used across contracts: letters, digits, "_", "-", ".".
Id = Annotated[str, Field(pattern=r"^[A-Za-z0-9_.-]+$", min_length=1, max_length=64)]


def find_duplicates(ids: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in ids:
        if item in seen:
            duplicates.add(item)
        seen.add(item)
    return sorted(duplicates)


def unknown_ids(context: str, ids: Iterable[str], known: set[str]) -> list[str]:
    return [f"{context}: unknown id '{item}'" for item in ids if item not in known]
