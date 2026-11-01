"""Stub endpoints. Request/response models are added with the contracts (setup step 9b)."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


def _not_implemented() -> HTTPException:
    return HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented yet")


@router.post("/interrogate", tags=["interrogation"], summary="Answer a question as a suspect")
def interrogate() -> None:
    raise _not_implemented()


@router.post(
    "/generate",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["generation"],
    summary="Start generating a case; returns a job id",
)
def start_generation() -> None:
    raise _not_implemented()


@router.get("/generate/{job_id}", tags=["generation"], summary="Generation status, then the case")
def get_generation(job_id: str) -> None:
    raise _not_implemented()


@router.post("/validate", tags=["validation"], summary="Check a case against the checklist")
def validate_case() -> None:
    raise _not_implemented()
