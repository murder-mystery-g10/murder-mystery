import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from ai_service.config import Settings, get_settings


def require_internal_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_key: Annotated[str | None, Header()] = None,
) -> None:
    """Reject any call that does not carry the shared internal API key."""
    if x_internal_key is None or not secrets.compare_digest(
        x_internal_key, settings.internal_api_key
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid internal API key")
