import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from ai_service.config import Settings
from ai_service.main import create_app
from ai_service.providers import (
    ChatCompletionsProvider,
    FakeProvider,
    Message,
    ProviderError,
    create_provider,
)

MESSAGES: list[Message] = [{"role": "user", "content": "Unde erai la 22?"}]


def reply(content: str | None = "În bucătărie.", finish_reason: str = "stop") -> dict:
    return {"choices": [{"message": {"content": content}, "finish_reason": finish_reason}]}


def provider_for(handler, **options) -> ChatCompletionsProvider:
    defaults = {"name": "test", "base_url": "https://example.test/openai/v1", "model": "m"}
    return ChatCompletionsProvider(**(defaults | options), transport=httpx.MockTransport(handler))


def generate(provider: ChatCompletionsProvider, **options) -> str:
    async def run() -> str:
        try:
            return await provider.generate(MESSAGES, **options)
        finally:
            await provider.aclose()

    return asyncio.run(run())


def test_sends_a_chat_completions_request() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=reply())

    provider = provider_for(
        handler, api_key="secret", auth_header="api-key", reasoning_effort="minimal"
    )
    schema = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}

    assert generate(provider, json_schema=schema) == "În bucătărie."
    request = seen[0]
    assert str(request.url) == "https://example.test/openai/v1/chat/completions"
    assert request.headers["api-key"] == "secret"
    body = json.loads(request.content)
    assert body["model"] == "m"
    assert body["messages"] == MESSAGES
    assert body["reasoning_effort"] == "minimal"
    assert body["response_format"]["json_schema"]["schema"] == schema


def test_bearer_auth_and_no_optional_fields() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=reply())

    generate(provider_for(handler, api_key="secret"))
    assert seen[0].headers["authorization"] == "Bearer secret"
    body = json.loads(seen[0].content)
    assert "reasoning_effort" not in body
    assert "response_format" not in body


@pytest.mark.parametrize(
    ("response", "message"),
    [
        (httpx.Response(500, text="boom"), "HTTP 500"),
        (httpx.Response(429, text="slow down"), "HTTP 429"),
        (httpx.Response(200, text="not json"), "unexpected response"),
        (httpx.Response(200, json={"choices": []}), "unexpected response"),
        (httpx.Response(200, json=reply(content=None)), "empty answer"),
        (httpx.Response(200, json=reply(finish_reason="content_filter")), "refused"),
        (httpx.Response(200, json=reply(finish_reason="length")), "cut the answer off"),
    ],
)
def test_bad_answers_raise_provider_error(response: httpx.Response, message: str) -> None:
    with pytest.raises(ProviderError, match=message):
        generate(provider_for(lambda request: response))


def test_unreachable_provider_raises_provider_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(ProviderError, match="cannot reach test"):
        generate(provider_for(handler))


def test_slow_provider_times_out() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(1)
        return httpx.Response(200, json=reply())

    with pytest.raises(ProviderError, match="did not answer within 0.05 s"):
        generate(provider_for(handler, timeout=0.05))


def test_create_provider_from_settings() -> None:
    settings = Settings(
        internal_api_key="k",
        ai_provider="azure",
        ai_base_url="https://mm.openai.azure.com/openai/v1",
        ai_model="gpt-5-mini",
        ai_api_key="secret",
    )
    provider = create_provider(settings)
    assert isinstance(provider, ChatCompletionsProvider)
    assert provider.name == "azure"


def test_hosted_providers_need_a_key() -> None:
    with pytest.raises(ValueError, match="AI_API_KEY is required"):
        Settings(internal_api_key="k", ai_provider="azure", ai_api_key=None)


def test_fake_provider_replays_answers() -> None:
    fake = FakeProvider("unu", ProviderError("down"))
    assert asyncio.run(fake.generate(MESSAGES)) == "unu"
    with pytest.raises(ProviderError, match="down"):
        asyncio.run(fake.generate(MESSAGES))
    assert fake.calls == [MESSAGES, MESSAGES]


def test_provider_error_becomes_503() -> None:
    app = create_app()

    @app.get("/boom")
    def boom() -> None:
        raise ProviderError("azure did not answer within 20 s")

    response = TestClient(app).get("/boom")
    assert response.status_code == 503
    assert "did not answer" in response.json()["detail"]
