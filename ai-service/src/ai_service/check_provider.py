"""Send one message to the configured provider and print the answer and how long it took.

Usage, from the repository root:
uv run --package ai-service python -m ai_service.check_provider "Hello"
"""

import asyncio
import sys
import time

from ai_service.config import get_settings
from ai_service.providers import ProviderError, create_provider


async def check(question: str) -> int:
    settings = get_settings()
    provider = create_provider(settings)
    start = time.perf_counter()
    try:
        answer = await provider.generate([{"role": "user", "content": question}])
    except ProviderError as error:
        print(f"Error: {error}")
        return 1
    finally:
        await provider.aclose()
    print(answer)
    print(f"\n{settings.ai_provider} / {settings.ai_model}, {time.perf_counter() - start:.1f} s")
    return 0


if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "Answer in one sentence: what time is it?"
    sys.exit(asyncio.run(check(question)))
