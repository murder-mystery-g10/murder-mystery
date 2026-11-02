"""AI service endpoints. Not implemented yet: they validate the request and return 501."""

from fastapi import APIRouter, HTTPException, status

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
def interrogate(request: InterrogateRequest) -> InterrogateResponse:
    raise _not_implemented()


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
    raise _not_implemented()
