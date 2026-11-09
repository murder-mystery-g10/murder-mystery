"""Game REST API: creating and joining a lobby, the case library and the theme maps.

Everything that happens after joining goes through Socket.IO (backend.sockets).
"""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import lobby_join
from backend.lobby import LobbyError, case_summary
from backend.models import CaseRecord, CaseSource
from backend.themes import load_theme_map
from shared_schemas import ThemeMap
from shared_schemas.game_api import (
    CaseSummary,
    CreateLobbyRequest,
    JoinLobbyRequest,
    LobbySession,
)

router = APIRouter(prefix="/api")


@router.post(
    "/lobbies",
    status_code=status.HTTP_201_CREATED,
    tags=["lobby"],
    summary="Create a lobby; the creator is the host",
)
async def create_lobby(data: CreateLobbyRequest, request: Request) -> LobbySession:
    async with AsyncSession(request.app.state.engine) as db:
        try:
            return await lobby_join.create_lobby(db, data)
        except lobby_join.InvalidName as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None


@router.post(
    "/lobbies/{code}/join",
    tags=["lobby"],
    summary="Join a lobby by code",
    responses={
        404: {"description": "No lobby with this code"},
        409: {"description": "Name taken, lobby full, solo lobby or game already started"},
    },
)
async def join_lobby(code: str, data: JoinLobbyRequest, request: Request) -> LobbySession:
    async with AsyncSession(request.app.state.engine) as db:
        try:
            return await lobby_join.join_lobby(db, code, data)
        except lobby_join.LobbyNotFound:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No lobby with this code.") from None
        except lobby_join.InvalidName as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
        except LobbyError as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from None


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


@router.get(
    "/themes/{theme_id}/map",
    tags=["themes"],
    summary="Rooms, objects and doors",
    responses={404: {"description": "No such theme, or it has no map.json yet"}},
)
def get_theme_map(theme_id: str, request: Request) -> ThemeMap:
    theme_map = load_theme_map(request.app.state.settings.themes_dir, theme_id)
    if theme_map is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No map for this theme.")
    return theme_map
