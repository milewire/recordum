"""Strict schema for LLM advisory output.

The LLM produces structured JSON matching this schema.
It must never recommend actions or make decisions.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LLMOutput(BaseModel):
    summary: str = Field(
        ..., description="Factual summary of the input"
    )
    request_type: str = Field(
        ..., description="Classified type of request"
    )
    extracted_facts: dict[str, str] = Field(
        ..., description="Key-value pairs of facts extracted from the input"
    )
    risk_notes: str = Field(
        ..., description="Observed risks, if any"
    )
    confidence_score: float = Field(
        ..., ge=0, le=1, description="Model confidence between 0 and 1"
    )


LLM_OUTPUT_SCHEMA: dict = LLMOutput.model_json_schema()
