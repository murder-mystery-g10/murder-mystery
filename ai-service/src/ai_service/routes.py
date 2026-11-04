"""AI service endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ai_service.interrogation import run_interrogation
from ai_service.providers import LLMProvider, get_provider
from ai_service.validation import build_validation_report
from shared_schemas.ai_api import (
    GenerateRequest,
    GenerationAccepted,
    GenerationJob,
    InterrogateRequest,
    InterrogateResponse,
    ValidateRequest,
    ValidationReport,
)

router = APIRouter()


def _not_implemented() -> HTTPException:
    return HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented yet")


@router.post("/interrogate", tags=["interrogation"], summary="Answer a question as a suspect")
async def interrogate(
    request: InterrogateRequest,
    provider: Annotated[LLMProvider, Depends(get_provider)],
) -> InterrogateResponse:
    if not any(suspect.id == request.suspect_id for suspect in request.case.suspects):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown suspect id")
    return await run_interrogation(request, provider)


@router.post(
    "/generate",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["generation"],
    summary="Start generating a case; returns a job id",
)
def start_generation(request: GenerateRequest) -> GenerationAccepted:
    raise _not_implemented()


@router.get("/generate/{job_id}", tags=["generation"], summary="Generation status, then the case")
def get_generation(job_id: str) -> GenerationJob:
    raise _not_implemented()


@router.post("/validate", tags=["validation"], summary="Check a case against the checklist")
def validate_case(request: ValidateRequest) -> ValidationReport:
    """Rules and checklist: docs/case-design.md."""
    return build_validation_report(request.case)
