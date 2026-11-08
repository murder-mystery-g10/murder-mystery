"""Theme map: rooms, clickable objects and doors of one theme.

The map is fixed per theme (images are drawn once); cases only refer to its ids.
"""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from shared_schemas.base import Id, Schema, find_duplicates

STATION = "station"
"""Location id of the police station (interrogation + board).

Not a room of the map: players reach it with a button in the interface, never through a door.
"""


class Point(Schema):
    x: float = Field(ge=0, le=100, description="Percent of the image width")
    y: float = Field(ge=0, le=100, description="Percent of the image height")


Polygon = Annotated[list[Point], Field(min_length=3)]


class MapObject(Schema):
    id: Id = Field(description="Unique in the whole map, by convention '<room>.<object>'")
    name: str
    zone: Polygon


class Door(Schema):
    id: Id
    to: Id = Field(description="Target room id (never the police station)")
    zone: Polygon


class MapRoom(Schema):
    id: Id
    name: str = Field(description="Display name shown to players")
    image: str = Field(description="Background image path, relative to the theme folder")
    objects: list[MapObject]
    doors: list[Door] = Field(
        default_factory=list,
        description="Clickable doors to other rooms; optional, doors may be decoration only",
    )


class ThemeMap(Schema):
    schema_version: Literal[1] = 1
    theme_id: Id
    name: str
    station_image: str = Field(description="Police station image, relative to the theme folder")
    rooms: list[MapRoom] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_references(self) -> Self:
        errors: list[str] = []
        room_ids = [room.id for room in self.rooms]
        id_lists = {
            "room": room_ids,
            "object": [obj.id for room in self.rooms for obj in room.objects],
            "door": [door.id for room in self.rooms for door in room.doors],
        }
        for label, ids in id_lists.items():
            errors += [f"duplicate {label} id '{dup}'" for dup in find_duplicates(ids)]
        if STATION in room_ids:
            errors.append(f"'{STATION}' is reserved and cannot be a room id")

        targets = set(room_ids)
        for room in self.rooms:
            for door in room.doors:
                if door.to == STATION:
                    errors.append(
                        f"door {door.id}: the police station is reached from the interface, "
                        "not through a door"
                    )
                elif door.to not in targets:
                    errors.append(f"door {door.id}: unknown target '{door.to}'")
                elif door.to == room.id:
                    errors.append(f"door {door.id}: leads to its own room")
        if errors:
            raise ValueError("; ".join(errors))
        return self

    def object_rooms(self) -> dict[str, str]:
        """Map each object id to the id of the room it is in."""
        return {obj.id: room.id for room in self.rooms for obj in room.objects}
