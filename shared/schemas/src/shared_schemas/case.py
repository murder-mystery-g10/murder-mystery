"""Case schema: the full truth of one mystery.

A case lives only in the backend and the AI service; it never reaches the browser.
The schema checks that references are consistent. The design rules (rule of two,
nobody solves alone, ...) are in docs/case-design.md and are checked by POST /validate.
"""

from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from shared_schemas.base import Id, Schema, find_duplicates, unknown_ids
from shared_schemas.theme_map import ThemeMap


class Difficulty(StrEnum):
    EASY = "easy"
    NORMAL = "normal"
    HARD = "hard"


class ClueType(StrEnum):
    CRITICAL = "C"
    FALSE_LEAD = "F"
    ELIMINATION = "E"
    LEVERAGE = "P"
    ACCESS = "A"
    CONTEXT = "T"


class Pillar(StrEnum):
    METHOD = "method"
    MEANS = "means"
    MOTIVE = "motive"
    OPPORTUNITY = "opportunity"


class ClueIcon(StrEnum):
    LETTER = "letter"
    DOCUMENT = "document"
    BOTTLE = "bottle"
    KEY = "key"
    PHOTO = "photo"
    ITEM = "item"


# --- briefing -----------------------------------------------------------------


class Person(Schema):
    name: str
    age: int | None = None
    description: str


class StoryHook(Schema):
    text: str
    points_to_room: Id


class Briefing(Schema):
    when: str
    where: str
    victim: Person
    summary: str
    discovery: str
    coroner_report: list[str]
    story_hooks: list[StoryHook] = Field(default_factory=list)


# --- hidden truth -------------------------------------------------------------


class TimelineEvent(Schema):
    id: Id
    time: str = Field(description="Story time label, e.g. '21:45'; list order is chronological")
    event: str
    proven_by: list[Id] = Field(default_factory=list, description="Physical clue ids")
    witnessed_by: list[Id] = Field(
        default_factory=list,
        description="Suspects who know about this event; a suspect's sheet only includes these",
    )


class Truth(Schema):
    culprit: Id
    motive: str
    method: str
    timeline: list[TimelineEvent] = Field(min_length=1)


# --- suspects -----------------------------------------------------------------


class Deflection(Schema):
    suspect: Id
    claim: str


class Testimony(Schema):
    """Verbal clue: something true the suspect says only when asked about it precisely."""

    id: Id
    fact: str
    trigger: str = Field(description="What the question must be about for the suspect to say it")
    event: Id | None = Field(default=None, description="Timeline event the testimony is about")


class BreakStage(Schema):
    triggers: list[list[Id]] = Field(
        min_length=1,
        description=(
            "Alternatives (OR) of evidence combinations (AND); ids are clue or testimony ids. "
            "A combination is met once all its ids have been shown to this suspect, "
            "possibly across different questions."
        ),
    )
    admits: str = Field(description="What the suspect admits at this stage")
    unlocks: list[Id] = Field(
        default_factory=list,
        description="Testimony ids the suspect only shares from this stage on",
    )


class Suspect(Schema):
    id: Id
    name: str
    age: int
    role: str
    archetype: Id = Field(description="Character type; picks the portrait set")
    personality: str
    speech_style: str
    initial_statement: str
    secret: str | None = Field(
        default=None, description="Required for innocents; the culprit's secret is the crime"
    )
    lies_about: list[str]
    deflects_to: list[Deflection] = Field(default_factory=list)
    testimonies: list[Testimony] = Field(default_factory=list)
    break_stages: list[BreakStage] = Field(
        min_length=1, description="In order; innocents usually have one, the culprit several"
    )


# --- rooms, players, clues ------------------------------------------------------


class KeyLock(Schema):
    type: Literal["key"] = "key"
    key_clue: Id


class CodeLock(Schema):
    type: Literal["code"] = "code"
    code: str
    hint_clues: list[Id] = Field(min_length=1)


Lock = Annotated[KeyLock | CodeLock, Field(discriminator="type")]


class CaseRoom(Schema):
    room: Id = Field(description="Room id from the theme map")
    lock: Lock | None = Field(default=None, description="None means open at the start")


class PlayerSlot(Schema):
    id: Id
    rooms: list[Id] = Field(min_length=1)


class Clue(Schema):
    id: Id
    object: Id = Field(description="Clickable object id from the theme map")
    type: ClueType
    pillar: Pillar | None = Field(default=None, description="Only for critical (C) clues")
    also: list[ClueType] = Field(default_factory=list, description="Secondary roles")
    icon: ClueIcon
    title: str
    player_text: str = Field(description="Exactly what the player reads when they find it")
    proves: str
    refutes: list[Id] = Field(default_factory=list, description="False-lead clue ids it disproves")


# --- accusation -----------------------------------------------------------------


class AccusationOption(Schema):
    id: Id
    text: str


class Accusation(Schema):
    """The culprit is picked among the suspects; motive and method among 4 options each."""

    motive_options: list[AccusationOption] = Field(min_length=4, max_length=4)
    correct_motive: Id
    method_options: list[AccusationOption] = Field(min_length=4, max_length=4)
    correct_method: Id


# --- case -----------------------------------------------------------------------


class Case(Schema):
    schema_version: Literal[1] = 1
    case_id: Id
    title: str
    theme: Id = Field(description="theme_id of the map this case is built on")
    difficulty: Difficulty
    player_count: int = Field(ge=3, le=5)
    questions_per_suspect: int = Field(ge=1)
    briefing: Briefing
    truth: Truth
    suspects: list[Suspect] = Field(min_length=3)
    rooms: list[CaseRoom]
    players: list[PlayerSlot]
    clues: list[Clue]
    accusation: Accusation
    reveal: str = Field(description="Final reveal story, generated with the case")

    @model_validator(mode="after")
    def _check_references(self) -> Self:
        errors = find_reference_errors(self)
        if errors:
            raise ValueError("; ".join(errors))
        return self


def find_reference_errors(case: Case) -> list[str]:
    """Internal consistency of a case (no map needed)."""
    errors: list[str] = []
    suspect_ids = {s.id for s in case.suspects}
    clue_ids = {c.id for c in case.clues}
    room_ids = {r.room for r in case.rooms}
    event_ids = {e.id for e in case.truth.timeline}
    testimony_ids = {t.id for s in case.suspects for t in s.testimonies}

    id_lists = {
        "suspect": [s.id for s in case.suspects],
        "clue": [c.id for c in case.clues],
        "room": [r.room for r in case.rooms],
        "player": [p.id for p in case.players],
        "timeline event": [e.id for e in case.truth.timeline],
        "testimony": [t.id for s in case.suspects for t in s.testimonies],
    }
    for label, ids in id_lists.items():
        errors += [f"duplicate {label} id '{dup}'" for dup in find_duplicates(ids)]
    if clue_ids & testimony_ids:
        both = sorted(clue_ids & testimony_ids)
        errors.append(f"ids used for both a clue and a testimony: {both}")

    if case.truth.culprit not in suspect_ids:
        errors.append(f"culprit '{case.truth.culprit}' is not a suspect")
    for event in case.truth.timeline:
        errors += unknown_ids(f"event {event.id} proven_by", event.proven_by, clue_ids)
        errors += unknown_ids(f"event {event.id} witnessed_by", event.witnessed_by, suspect_ids)
    for hook in case.briefing.story_hooks:
        errors += unknown_ids("story hook", [hook.points_to_room], room_ids)

    witnesses = {e.id: set(e.witnessed_by) for e in case.truth.timeline}
    evidence_ids = clue_ids | testimony_ids
    for suspect in case.suspects:
        where = f"suspect {suspect.id}"
        if suspect.id != case.truth.culprit and not suspect.secret:
            errors.append(f"{where}: innocent suspects need a secret")
        errors += unknown_ids(
            f"{where} deflects_to", [d.suspect for d in suspect.deflects_to], suspect_ids
        )
        for testimony in suspect.testimonies:
            if testimony.event is None:
                continue
            if testimony.event not in event_ids:
                errors.append(
                    f"{where} testimony {testimony.id}: unknown event '{testimony.event}'"
                )
            elif suspect.id not in witnesses[testimony.event]:
                errors.append(
                    f"{where} testimony {testimony.id}: "
                    f"suspect did not witness event '{testimony.event}'"
                )
        own_testimonies = {t.id for t in suspect.testimonies}
        for number, stage in enumerate(suspect.break_stages, start=1):
            for combination in stage.triggers:
                if not combination:
                    errors.append(f"{where} stage {number}: empty trigger combination")
                errors += unknown_ids(f"{where} stage {number} trigger", combination, evidence_ids)
            errors += unknown_ids(f"{where} stage {number} unlocks", stage.unlocks, own_testimonies)

    for room in case.rooms:
        match room.lock:
            case KeyLock(key_clue=key):
                errors += unknown_ids(f"room {room.room} key", [key], clue_ids)
            case CodeLock(hint_clues=hints):
                errors += unknown_ids(f"room {room.room} code hints", hints, clue_ids)

    if len(case.players) != case.player_count:
        errors.append(
            f"player_count is {case.player_count} but {len(case.players)} players are defined"
        )
    for player in case.players:
        errors += unknown_ids(f"player {player.id} rooms", player.rooms, room_ids)

    for clue in case.clues:
        if (clue.type == ClueType.CRITICAL) != (clue.pillar is not None):
            errors.append(
                f"clue {clue.id}: pillar is required for critical clues, and only for them"
            )
        errors += unknown_ids(f"clue {clue.id} refutes", clue.refutes, clue_ids)

    accusation = case.accusation
    for kind, options, correct in (
        ("motive", accusation.motive_options, accusation.correct_motive),
        ("method", accusation.method_options, accusation.correct_method),
    ):
        option_ids = [option.id for option in options]
        errors += [f"duplicate {kind} option id '{dup}'" for dup in find_duplicates(option_ids)]
        if correct not in option_ids:
            errors.append(f"correct {kind} '{correct}' is not one of the options")
    return errors


def find_map_errors(case: Case, theme_map: ThemeMap) -> list[str]:
    """Consistency between a case and the theme map it is built on."""
    errors: list[str] = []
    if case.theme != theme_map.theme_id:
        errors.append(f"case theme '{case.theme}' does not match map '{theme_map.theme_id}'")
    map_rooms = {room.id for room in theme_map.rooms}
    case_rooms = {room.room for room in case.rooms}
    errors += [f"room '{r}' is not in the map" for r in sorted(case_rooms - map_rooms)]
    errors += [f"map room '{r}' is missing from the case" for r in sorted(map_rooms - case_rooms)]
    objects = theme_map.object_rooms()
    for clue in case.clues:
        if clue.object not in objects:
            errors.append(f"clue {clue.id}: object '{clue.object}' is not in the map")
    return errors
