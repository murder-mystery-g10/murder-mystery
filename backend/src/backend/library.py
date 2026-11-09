"""Case library: on startup, load every case in `cases/`, validate it and store it.

A file goes into the `cases` table only if it parses as a `Case` and the AI service's
`POST /validate` reports no errors (warnings are allowed). `GET /api/cases` then lists what is
in the table. The AI service may still be starting when the backend starts, so loading runs in
the background and retries for a while.
"""

import asyncio
import logging
from pathlib import Path

import httpx
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from backend.ai_client import AIClient
from backend.models import CaseRecord, CaseSource
from shared_schemas.ai_api import Severity, ValidateRequest
from shared_schemas.case import Case

logger = logging.getLogger(__name__)

RETRY_ATTEMPTS = 30
RETRY_DELAY_SECONDS = 2.0


def read_cases(cases_dir: Path) -> list[Case]:
    """Every `*.json` in the folder that parses as a `Case`; broken files are logged and skipped."""
    cases = []
    for path in sorted(cases_dir.glob("*.json")):
        try:
            cases.append(Case.model_validate_json(path.read_bytes()))
        except (OSError, ValidationError) as error:
            logger.error("case library: skipping %s, it is not a valid case: %s", path.name, error)
    return cases


async def validated_cases(cases: list[Case], ai_client: AIClient) -> list[Case]:
    """The cases for which the AI service reports no errors.

    Raises httpx.HTTPError when the AI service cannot be reached.
    """
    accepted = []
    for case in cases:
        report = await ai_client.validate(ValidateRequest(case=case))
        if report.valid:
            accepted.append(case)
            continue
        errors = [issue.message for issue in report.issues if issue.severity == Severity.ERROR]
        logger.error("case library: rejected %s: %s", case.case_id, "; ".join(errors))
    return accepted


async def store_cases(engine: AsyncEngine, cases: list[Case]) -> None:
    """Insert the cases, or update them if they are already in the table."""
    async with AsyncSession(engine) as db:
        for case in cases:
            values = {
                "title": case.title,
                "theme": case.theme,
                "difficulty": case.difficulty,
                "player_count": case.player_count,
                "source": CaseSource.LIBRARY,
                "data": case.model_dump(mode="json"),
            }
            await db.execute(
                insert(CaseRecord)
                .values(id=case.case_id, **values)
                .on_conflict_do_update(index_elements=[CaseRecord.id], set_=values)
            )
        await db.commit()


async def load_library(engine: AsyncEngine, ai_client: AIClient, cases_dir: Path) -> list[str]:
    """Read, validate and store the library. Returns the ids of the stored cases."""
    cases = await validated_cases(read_cases(cases_dir), ai_client)
    await store_cases(engine, cases)
    return [case.case_id for case in cases]


async def load_library_in_background(
    engine: AsyncEngine,
    ai_client: AIClient,
    cases_dir: Path,
    attempts: int = RETRY_ATTEMPTS,
    delay: float = RETRY_DELAY_SECONDS,
) -> None:
    """Load the library, retrying while the AI service or the database is not reachable yet."""
    for attempt in range(1, attempts + 1):
        try:
            stored = await load_library(engine, ai_client, cases_dir)
        except (httpx.HTTPError, OSError, SQLAlchemyError) as error:
            logger.warning(
                "case library: attempt %d/%d failed (%s); retrying in %.0fs",
                attempt,
                attempts,
                error,
                delay,
            )
            await asyncio.sleep(delay)
            continue
        logger.info("case library: %d case(s) stored: %s", len(stored), ", ".join(stored))
        return
    logger.error("case library: gave up after %d attempts; no case was loaded", attempts)
