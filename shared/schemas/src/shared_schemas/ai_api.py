"""Contract of the internal AI service.

Called only by the backend, with the X-Internal-Key header. The service is
stateless: every request carries everything it needs. Theme maps are read
from themes/<theme>/map.json, by case.theme.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from shared_schemas.base import Id, Schema
from shared_schemas.case import Case, Difficulty
from shared_schemas.health import HealthResponse

MAX_QUESTION_LENGTH = 300


class Emotion(StrEnum):
    CALM = "calm"
    NERVOUS = "nervous"
    ANGRY = "angry"
    SAD = "sad"
    ARROGANT = "arrogant"
    BROKEN = "broken"


# --- POST /interrogate ------------------------------------------------------------


class DialogueTurn(Schema):
    question: str
    evidence: Id | None = None
    answer: str


class InterrogationState(Schema):
    """Decided by the backend before calling the AI service."""

    break_stage: int = Field(ge=0, description="Highest break stage reached (0 = not broken)")
    just_broke: bool = Field(
        default=False,
        description="True if the evidence shown with this question made the suspect break now",
    )
    revealed_testimonies: list[Id] = Field(
        default_factory=list,
        description="Testimony ids the suspect already shared in earlier answers",
    )


class InterrogateRequest(Schema):
    case: Case
    suspect_id: Id
    question: str = Field(min_length=1, max_length=MAX_QUESTION_LENGTH)
    evidence: Id | None = Field(
        default=None,
        description="Clue or testimony id shown with this question",
    )
    history: list[DialogueTurn] = Field(
        default_factory=list,
        description="Earlier questions to this suspect, oldest first",
    )
    state: InterrogationState


class InterrogateResponse(Schema):
    answer: str = Field(description="1-4 sentences, in character, in Romanian")
    emotion: Emotion
    intensity: float = Field(ge=0, le=1)
    revealed_testimonies: list[Id] = Field(
        default_factory=list,
        description="Testimony ids shared in this answer",
    )


# --- POST /generate, GET /generate/{job_id} ------------------------------------------


class GenerateRequest(Schema):
    theme: Id
    player_count: int = Field(ge=3, le=5)
    suspect_count: int = Field(ge=3, le=5)
    difficulty: Difficulty
    tone: str | None = Field(default=None, max_length=200)
    idea: str | None = Field(default=None, max_length=500, description="Host's starting idea")


class GenerationAccepted(Schema):
    job_id: str


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class GenerationJob(Schema):
    job_id: str
    status: JobStatus
    step: str | None = Field(default=None, description="Current step, for the waiting screen")
    case: Case | None = Field(default=None, description="Set when status is succeeded")
    error: str | None = Field(default=None, description="Set when status is failed")


# --- POST /validate ------------------------------------------------------------------


class ValidateRequest(Schema):
    case: Case


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


class ValidationIssue(Schema):
    rule: str = Field(description="Checklist rule, e.g. 'rule_of_two'")
    severity: Severity
    message: str


class ValidationReport(Schema):
    valid: bool = Field(description="True when there are no errors (warnings are allowed)")
    issues: list[ValidationIssue] = Field(default_factory=list)


MODELS: list[type[BaseModel]] = [
    HealthResponse,
    InterrogateRequest,
    InterrogateResponse,
    GenerateRequest,
    GenerationAccepted,
    GenerationJob,
    ValidateRequest,
    ValidationReport,
]
