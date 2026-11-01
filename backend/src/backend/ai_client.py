import httpx

from shared_schemas import HealthResponse


class AIClient:
    """HTTP client for the internal AI service. Sends the shared key on every call."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"X-Internal-Key": api_key},
            timeout=timeout,
        )

    async def is_healthy(self) -> bool:
        try:
            response = await self._client.get("/health", timeout=2.0)
            response.raise_for_status()
            HealthResponse.model_validate(response.json())
        except (httpx.HTTPError, ValueError):
            return False
        return True

    async def aclose(self) -> None:
        await self._client.aclose()
