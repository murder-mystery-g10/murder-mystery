"""Game REST API. Endpoints that are not implemented yet return 501."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.lobby import case_summary
from backend.models import CaseRecord, CaseSource
from shared_schemas import ThemeMap
from shared_schemas.game_api import (
    CaseSummary,
    CreateLobbyRequest,
    JoinLobbyRequest,
    LobbySession,
)

router = APIRouter(prefix="/api")


def _not_implemented() -> HTTPException:
    return HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented yet")


@router.post(
    "/lobbies",
    status_code=status.HTTP_201_CREATED,
    tags=["lobby"],
    summary="Create a lobby; the creator is the host",
)
def create_lobby(request: CreateLobbyRequest) -> LobbySession:
    raise _not_implemented()


@router.post("/lobbies/{code}/join", tags=["lobby"], summary="Join a lobby by code")
def join_lobby(code: str, request: JoinLobbyRequest) -> LobbySession:
    raise _not_implemented()


@router.get("/cases", tags=["cases"], summary="Cases in the library")
async def list_cases(request: Request) -> list[CaseSummary]:
    """Only cases that were validated and stored at startup (backend.library)."""
    async with AsyncSession(request.app.state.engine) as db:
        records = await db.scalars(
            select(CaseRecord)
            .where(CaseRecord.source == CaseSource.LIBRARY)
            .order_by(CaseRecord.title)
        )
        return [case_summary(record) for record in records]


@router.get("/themes/{theme_id}/map", tags=["themes"], summary="Rooms, objects and doors")
def get_theme_map(theme_id: str) -> ThemeMap:
    raise _not_implemented()
