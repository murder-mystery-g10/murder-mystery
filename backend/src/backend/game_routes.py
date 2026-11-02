"""Game REST API. Not implemented yet (the backend team owns these): every endpoint returns 501."""

from fastapi import APIRouter, HTTPException, status

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
def list_cases() -> list[CaseSummary]:
    raise _not_implemented()


@router.get("/themes/{theme_id}/map", tags=["themes"], summary="Rooms, objects and doors")
def get_theme_map(theme_id: str) -> ThemeMap:
    raise _not_implemented()
