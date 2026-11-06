"""Deterministic checks for the case-design rules."""

from collections import Counter
from collections.abc import Callable

from shared_schemas.ai_api import Severity, ValidationIssue, ValidationReport
from shared_schemas.case import Case, Clue, ClueType, CodeLock, Difficulty, Pillar


def _room_of(clue: Clue) -> str:
    """Return the room prefix from a ``room.object`` clue location."""
    return clue.object.split(".", maxsplit=1)[0]


def _error(rule: str, message: str) -> ValidationIssue:
    return ValidationIssue(rule=rule, severity=Severity.ERROR, message=message)


def _check_clue_counts(case: Case) -> ValidationIssue | None:
    type_counts = Counter(clue.type for clue in case.clues)
    pillar_counts = Counter(clue.pillar for clue in case.clues if clue.type == ClueType.CRITICAL)
    innocent_count = len(case.suspects) - 1
    false_lead_minimum = innocent_count * (2 if case.difficulty == Difficulty.HARD else 1)
    access_minimum = sum(
        len(room.lock.hint_clues) if isinstance(room.lock, CodeLock) else 1
        for room in case.rooms
        if room.lock is not None
    )

    deficits: list[str] = []
    critical_minima = {
        Pillar.METHOD: 3,
        Pillar.MEANS: 2,
        Pillar.MOTIVE: 3,
        Pillar.OPPORTUNITY: 1,
    }
    for pillar, minimum in critical_minima.items():
        actual = pillar_counts[pillar]
        if actual < minimum:
            deficits.append(f"{pillar.value} critical clues: {actual}, need at least {minimum}")

    type_minima = {
        ClueType.FALSE_LEAD: false_lead_minimum,
        ClueType.ELIMINATION: innocent_count,
        ClueType.LEVERAGE: innocent_count,
        ClueType.ACCESS: access_minimum,
    }
    for clue_type, minimum in type_minima.items():
        actual = type_counts[clue_type]
        if actual < minimum:
            deficits.append(f"{clue_type.value} clues: {actual}, need at least {minimum}")

    context_count = type_counts[ClueType.CONTEXT]
    if not 2 <= context_count <= 3:
        deficits.append(f"T clues: {context_count}, need between 2 and 3")

    if not deficits:
        return None
    return _error("clue_counts", "; ".join(deficits))


def _check_rule_of_two(case: Case) -> ValidationIssue | None:
    failures: list[str] = []
    for pillar in (Pillar.METHOD, Pillar.MEANS, Pillar.MOTIVE):
        clues = [
            clue for clue in case.clues if clue.type == ClueType.CRITICAL and clue.pillar == pillar
        ]
        rooms = {_room_of(clue) for clue in clues}
        if len(clues) < 2 or len(rooms) < 2:
            failures.append(
                f"{pillar.value}: {len(clues)} clues across {len(rooms)} rooms; need 2 and 2"
            )

    opportunity_count = sum(
        clue.type == ClueType.CRITICAL and clue.pillar == Pillar.OPPORTUNITY for clue in case.clues
    )
    testimony_count = sum(len(suspect.testimonies) for suspect in case.suspects)
    if opportunity_count < 1 or testimony_count < 2:
        failures.append(
            "opportunity: "
            f"{opportunity_count} physical clues and {testimony_count} testimonies; need 1 and 2"
        )

    if not failures:
        return None
    return _error("rule_of_two", "; ".join(failures))


def _check_nobody_solves_alone(case: Case) -> ValidationIssue | None:
    all_pillars = set(Pillar)
    offending_players: list[str] = []
    for player in case.players:
        player_rooms = set(player.rooms)
        pillars = {
            clue.pillar
            for clue in case.clues
            if clue.type == ClueType.CRITICAL and _room_of(clue) in player_rooms
        }
        if pillars == all_pillars:
            offending_players.append(player.id)

    if not offending_players:
        return None
    return _error(
        "nobody_solves_alone",
        f"Players reaching all four pillars from their own rooms: {', '.join(offending_players)}",
    )


def _check_false_leads_refuted(case: Case) -> ValidationIssue | None:
    missing: list[str] = []
    for false_lead in (clue for clue in case.clues if clue.type == ClueType.FALSE_LEAD):
        refuted_elsewhere = any(
            false_lead.id in clue.refutes and _room_of(clue) != _room_of(false_lead)
            for clue in case.clues
        )
        if not refuted_elsewhere:
            missing.append(false_lead.id)

    if not missing:
        return None
    return _error(
        "false_leads_refuted",
        "False leads without a refuting clue in another room: " + ", ".join(missing),
    )


def _check_max_clues_per_room(case: Case) -> ValidationIssue | None:
    room_counts = Counter(_room_of(clue) for clue in case.clues)
    overcrowded = [f"{room} ({count})" for room, count in sorted(room_counts.items()) if count > 5]
    if not overcrowded:
        return None
    return _error(
        "max_clues_per_room",
        "Rooms with more than 5 clues: " + ", ".join(overcrowded),
    )


Check = Callable[[Case], ValidationIssue | None]
CHECKS: tuple[Check, ...] = (
    _check_clue_counts,
    _check_rule_of_two,
    _check_nobody_solves_alone,
    _check_false_leads_refuted,
    _check_max_clues_per_room,
)


def build_validation_report(case: Case) -> ValidationReport:
    """Run the automatic subset of ``docs/case-design.md`` checks."""
    issues = [issue for check in CHECKS if (issue := check(case)) is not None]
    return ValidationReport(
        valid=not any(issue.severity == Severity.ERROR for issue in issues),
        issues=issues,
    )
