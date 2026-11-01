import httpx

from shared_schemas import HealthResponse
from shared_schemas.ai_api import (
    GenerateRequest,
    GenerationAccepted,
    GenerationJob,
    InterrogateRequest,
    InterrogateResponse,
    ValidateRequest,
    ValidationReport,
)


class AIClient:
    """HTTP client for the internal AI service. Sends the shared key on every call.

    Every method raises httpx.HTTPError when the service fails or is unreachable;
    for /interrogate the backend then answers "the suspect refuses to talk" and
    does not consume the question.
    """

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

    async def interrogate(self, request: InterrogateRequest) -> InterrogateResponse:
        response = await self._client.post("/interrogate", json=request.model_dump(mode="json"))
        response.raise_for_status()
        return InterrogateResponse.model_validate(response.json())

    async def start_generation(self, request: GenerateRequest) -> GenerationAccepted:
        response = await self._client.post("/generate", json=request.model_dump(mode="json"))
        response.raise_for_status()
        return GenerationAccepted.model_validate(response.json())

    async def get_generation(self, job_id: str) -> GenerationJob:
        response = await self._client.get(f"/generate/{job_id}")
        response.raise_for_status()
        return GenerationJob.model_validate(response.json())

    async def validate(self, request: ValidateRequest) -> ValidationReport:
        response = await self._client.post("/validate", json=request.model_dump(mode="json"))
        response.raise_for_status()
        return ValidationReport.model_validate(response.json())

    async def aclose(self) -> None:
        await self._client.aclose()
