import copy

import pytest

SQUARE = [{"x": 10, "y": 10}, {"x": 20, "y": 10}, {"x": 20, "y": 20}, {"x": 10, "y": 20}]

MAP = {
    "theme_id": "test",
    "name": "Test",
    "station_image": "station.webp",
    "rooms": [
        {
            "id": "hall",
            "name": "Hol",
            "image": "rooms/hall.webp",
            "objects": [{"id": "hall.coat_rack", "name": "Cuier", "zone": SQUARE}],
            "doors": [
                {"id": "hall.to_library", "to": "library", "zone": SQUARE},
                {"id": "hall.to_cellar", "to": "cellar", "zone": SQUARE},
            ],
        },
        {
            "id": "library",
            "name": "Library",
            "image": "rooms/library.webp",
            "objects": [{"id": "library.desk", "name": "Birou", "zone": SQUARE}],
            "doors": [{"id": "library.to_hall", "to": "hall", "zone": SQUARE}],
        },
        {
            "id": "cellar",
            "name": "Cellar",
            "image": "rooms/cellar.webp",
            "objects": [{"id": "cellar.barrel", "name": "Butoi", "zone": SQUARE}],
            "doors": [{"id": "cellar.to_hall", "to": "hall", "zone": SQUARE}],
        },
    ],
}


def _suspect(suspect_id: str, **overrides: object) -> dict:
    data = {
        "id": suspect_id,
        "name": f"Suspect {suspect_id}",
        "age": 40,
        "role": "oaspete",
        "archetype": "gentleman",
        "personality": "calm",
        "speech_style": "formal",
        "initial_statement": "I did not see anything.",
        "secret": f"secretul lui {suspect_id}",
        "lies_about": ["where they were"],
        "break_stages": [{"triggers": [["letter"]], "admits": "admits the secret"}],
    }
    data.update(overrides)
    return data


CASE = {
    "case_id": "test_case",
    "title": "Cazul de test",
    "theme": "test",
    "difficulty": "normal",
    "player_count": 3,
    "questions_per_suspect": 6,
    "briefing": {
        "when": "the night of November 14, 1926",
        "where": "Test manor",
        "victim": {"name": "Victim", "age": 60, "description": "the owner"},
        "summary": "The victim was poisoned.",
        "discovery": "Found at 23:30.",
        "coroner_report": ["death between 22:45 and 23:15"],
        "story_hooks": [{"text": "The desk is in the library.", "points_to_room": "library"}],
    },
    "truth": {
        "culprit": "c",
        "motive": "bani",
        "method": "poison",
        "timeline": [
            {
                "id": "e1",
                "time": "21:45",
                "event": "c poisons the tea",
                "proven_by": ["poison"],
                "witnessed_by": ["c", "i1"],
            }
        ],
    },
    "suspects": [
        _suspect(
            "c",
            secret=None,
            break_stages=[
                {"triggers": [["poison"]], "admits": "admits the visit"},
                {"triggers": [["poison", "letter"]], "admits": "admits everything"},
            ],
        ),
        _suspect(
            "i1",
            testimonies=[{"id": "t1", "fact": "I saw c", "trigger": "at 21:45", "event": "e1"}],
            break_stages=[{"triggers": [["letter"]], "admits": "secretul", "unlocks": ["t1"]}],
        ),
        _suspect("i2"),
    ],
    "rooms": [
        {"room": "hall"},
        {"room": "library", "lock": {"type": "key", "key_clue": "key"}},
        {"room": "cellar", "lock": {"type": "code", "code": "1919", "hint_clues": ["letter"]}},
    ],
    "players": [
        {"id": "J1", "rooms": ["hall", "library"]},
        {"id": "J2", "rooms": ["library", "cellar"]},
        {"id": "J3", "rooms": ["hall", "cellar"]},
    ],
    "clues": [
        {
            "id": "key",
            "object": "hall.coat_rack",
            "type": "A",
            "icon": "key",
            "title": "Cheie",
            "player_text": "A small key.",
            "proves": "opens the library",
        },
        {
            "id": "poison",
            "object": "library.desk",
            "type": "C",
            "pillar": "method",
            "icon": "bottle",
            "title": "Bottle",
            "player_text": "An empty bottle.",
            "proves": "the poison",
        },
        {
            "id": "letter",
            "object": "cellar.barrel",
            "type": "P",
            "icon": "letter",
            "title": "Letter",
            "player_text": "A letter.",
            "proves": "secretul lui i1",
        },
    ],
    "accusation": {
        "motive_options": [{"id": f"m{n}", "text": f"motiv {n}"} for n in range(1, 5)],
        "correct_motive": "m1",
        "method_options": [{"id": f"x{n}", "text": f"method {n}"} for n in range(1, 5)],
        "correct_method": "x1",
    },
    "reveal": "c poisoned the tea.",
}


@pytest.fixture
def map_data() -> dict:
    return copy.deepcopy(MAP)


@pytest.fixture
def case_data() -> dict:
    return copy.deepcopy(CASE)
