"""Model providers behind one interface, so the rest of the service does not depend on a vendor.

Azure OpenAI (v1 API), OpenAI and Ollama all speak the OpenAI Chat Completions protocol, so one
HTTP client covers all three; only the authentication header differs.

Use it in a route with `provider: Annotated[LLMProvider, Depends(get_provider)]`; in tests,
override `get_provider` with a `FakeProvider`.
"""

import asyncio
from functools import lru_cache
from typing import Any, Literal, Protocol, TypedDict

import httpx

from ai_service.config import Settings, get_settings


class Message(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


class ProviderError(Exception):
    """The provider failed, refused or did not answer in time. Routes answer 503."""


class LLMProvider(Protocol):
    async def generate(
        self, messages: list[Message], *, json_schema: dict[str, Any] | None = None
    ) -> str:
        """Return the model's reply.

        With `json_schema`, the reply is a JSON string that follows the schema. Azure and OpenAI
        need a strict schema: every property listed in `required`, `additionalProperties: false`.
        Raises ProviderError when there is no usable reply.
        """
        ...

    async def aclose(self) -> None: ...


class ChatCompletionsProvider:
    """Any OpenAI-compatible Chat Completions endpoint."""

    def __init__(
        self,
        *,
        name: str,
        base_url: str,
        model: str,
        api_key: str | None = None,
        auth_header: Literal["api-key", "bearer"] = "bearer",
        timeout: float = 20.0,
        reasoning_effort: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        headers: dict[str, str] = {}
        if api_key:
            headers = (
                {"api-key": api_key}
                if auth_header == "api-key"
                else {"Authorization": f"Bearer {api_key}"}
            )
        self.name = name
        self._model = model
        self._timeout = timeout
        self._reasoning_effort = reasoning_effort
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/") + "/",
            headers=headers,
            timeout=timeout,
            transport=transport,
        )

    async def generate(
        self, messages: list[Message], *, json_schema: dict[str, Any] | None = None
    ) -> str:
        body: dict[str, Any] = {"model": self._model, "messages": messages}
        if self._reasoning_effort:
            body["reasoning_effort"] = self._reasoning_effort
        if json_schema is not None:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "reply", "schema": json_schema, "strict": True},
            }

        try:
            async with asyncio.timeout(self._timeout):
                response = await self._client.post("chat/completions", json=body)
        except (TimeoutError, httpx.TimeoutException) as error:
            raise ProviderError(f"{self.name} did not answer within {self._timeout:g} s") from error
        except httpx.HTTPError as error:
            raise ProviderError(f"cannot reach {self.name}: {error}") from error

        if response.is_error:
            raise ProviderError(
                f"{self.name} answered HTTP {response.status_code}: {response.text[:300]}"
            )
        try:
            choice = response.json()["choices"][0]
            message = choice["message"]
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise ProviderError(f"{self.name} sent an unexpected response") from error

        finish_reason = choice.get("finish_reason")
        if finish_reason == "content_filter" or message.get("refusal"):
            raise ProviderError(f"{self.name} refused to answer")
        if finish_reason == "length":
            raise ProviderError(f"{self.name} cut the answer off (token limit)")
        content = message.get("content")
        if not content:
            raise ProviderError(f"{self.name} sent an empty answer")
        return content

    async def aclose(self) -> None:
        await self._client.aclose()


class FakeProvider:
    """Answers with prepared replies, in order, and records what it was asked. For tests."""

    def __init__(self, *replies: str | Exception) -> None:
        self.replies = list(replies)
        self.calls: list[list[Message]] = []
        self.json_schemas: list[dict[str, Any] | None] = []

    async def generate(
        self, messages: list[Message], *, json_schema: dict[str, Any] | None = None
    ) -> str:
        self.calls.append(messages)
        self.json_schemas.append(json_schema)
        if not self.replies:
            raise ProviderError("FakeProvider has no replies left")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    async def aclose(self) -> None:
        pass


def create_provider(settings: Settings) -> LLMProvider:
    return ChatCompletionsProvider(
        name=settings.ai_provider,
        base_url=settings.ai_base_url,
        model=settings.ai_model,
        api_key=settings.ai_api_key,
        auth_header="api-key" if settings.ai_provider == "azure" else "bearer",
        timeout=settings.ai_timeout_seconds,
        reasoning_effort=settings.ai_reasoning_effort,
    )


@lru_cache
def get_provider() -> LLMProvider:
    return create_provider(get_settings())
