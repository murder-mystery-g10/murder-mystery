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
                {"id": "hall.to_station", "to": "station", "zone": SQUARE},
            ],
        },
        {
            "id": "library",
            "name": "Bibliotecă",
            "image": "rooms/library.webp",
            "objects": [{"id": "library.desk", "name": "Birou", "zone": SQUARE}],
            "doors": [{"id": "library.to_hall", "to": "hall", "zone": SQUARE}],
        },
        {
            "id": "cellar",
            "name": "Pivniță",
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
        "initial_statement": "N-am văzut nimic.",
        "secret": f"secretul lui {suspect_id}",
        "lies_about": ["unde era"],
        "break_stages": [{"triggers": [["letter"]], "admits": "recunoaște secretul"}],
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
        "when": "noaptea de 14 noiembrie 1926",
        "where": "Conacul de test",
        "victim": {"name": "Victima", "age": 60, "description": "proprietarul"},
        "summary": "Victima a fost otrăvită.",
        "discovery": "Găsită la 23:30.",
        "coroner_report": ["deces între 22:45 și 23:15"],
        "story_hooks": [{"text": "Biroul e în bibliotecă.", "points_to_room": "library"}],
    },
    "truth": {
        "culprit": "c",
        "motive": "bani",
        "method": "otravă",
        "timeline": [
            {
                "id": "e1",
                "time": "21:45",
                "event": "c otrăvește ceaiul",
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
                {"triggers": [["poison"]], "admits": "recunoaște vizita"},
                {"triggers": [["poison", "letter"]], "admits": "recunoaște tot"},
            ],
        ),
        _suspect(
            "i1",
            testimonies=[
                {"id": "t1", "fact": "l-am văzut pe c", "trigger": "ora 21:45", "event": "e1"}
            ],
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
            "player_text": "O cheie mică.",
            "proves": "deschide biblioteca",
        },
        {
            "id": "poison",
            "object": "library.desk",
            "type": "C",
            "pillar": "method",
            "icon": "bottle",
            "title": "Sticluță",
            "player_text": "O sticluță goală.",
            "proves": "otrava",
        },
        {
            "id": "letter",
            "object": "cellar.barrel",
            "type": "P",
            "icon": "letter",
            "title": "Scrisoare",
            "player_text": "O scrisoare.",
            "proves": "secretul lui i1",
        },
    ],
    "accusation": {
        "motive_options": [{"id": f"m{n}", "text": f"motiv {n}"} for n in range(1, 5)],
        "correct_motive": "m1",
        "method_options": [{"id": f"x{n}", "text": f"metodă {n}"} for n in range(1, 5)],
        "correct_method": "x1",
    },
    "reveal": "c a otrăvit ceaiul.",
}


@pytest.fixture
def map_data() -> dict:
    return copy.deepcopy(MAP)


@pytest.fixture
def case_data() -> dict:
    return copy.deepcopy(CASE)
