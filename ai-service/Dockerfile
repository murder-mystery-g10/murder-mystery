# Build context: repository root (needs uv.lock and shared/).
#   docker build -f ai-service/Dockerfile .
FROM python:3.13-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app

# Dependencies first, so this layer stays cached until the lockfile changes.
# uv needs the pyproject.toml of every workspace member.
COPY pyproject.toml uv.lock .python-version ./
COPY shared/schemas/pyproject.toml shared/schemas/
COPY ai-service/pyproject.toml ai-service/
COPY backend/pyproject.toml backend/
RUN uv sync --frozen --no-dev --package ai-service --no-install-workspace

COPY shared/schemas shared/schemas
COPY ai-service ai-service
RUN uv sync --frozen --no-dev --package ai-service --no-editable

FROM python:3.13-slim
RUN useradd --create-home app
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8001
CMD ["uvicorn", "ai_service.main:app", "--host", "0.0.0.0", "--port", "8001"]
