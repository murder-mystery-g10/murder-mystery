from pydantic import BaseModel, ConfigDict


class Schema(BaseModel):
    """Base class for every contract model.

    Unknown fields are rejected so that a typo or an out-of-date client
    fails loudly instead of being silently ignored.
    """

    model_config = ConfigDict(extra="forbid")
