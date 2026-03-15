"""Activity: normalize raw workflow input."""

from __future__ import annotations

import re
from dataclasses import dataclass

from temporalio import activity


@dataclass
class WorkflowInput:
    """Raw input submitted to the approval workflow."""

    title: str
    body: str
    submitted_by: str


@activity.defn
async def normalize_input(raw: WorkflowInput) -> WorkflowInput:
    """Strip whitespace, collapse runs, lowercase the submitter."""

    return WorkflowInput(
        title=_clean(raw.title),
        body=_clean(raw.body),
        submitted_by=raw.submitted_by.strip().lower(),
    )


def _clean(text: str) -> str:
    # Collapse runs of spaces/tabs within each line, but preserve newlines so
    # paragraph structure (and the "Request Type: …\n\n" prefix) survives.
    lines = text.split("\n")
    cleaned = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in lines)
    # Collapse 3+ consecutive blank lines down to two.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()
