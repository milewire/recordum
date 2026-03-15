"""Single Temporal workflow: ApprovalWorkflow.

Fully deterministic. No network calls. No randomness. No inline retries.
All I/O happens in activities. The LLM advises; the human decides.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from temporalio.exceptions import ApplicationError

    from app.activities.llm_summary import LLMSummaryActivities
    from app.activities.normalize_input import WorkflowInput, normalize_input
    from app.activities.write_audit import AuditActivities, AuditRow
    from app.schemas.llm_output import LLMOutput


def _canonical_json_hash(obj: object) -> str:
    blob = json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


@dataclass
class ApprovalSignal:
    """Signal payload sent by the human reviewer."""

    approved: bool
    comment: str
    decided_by: str = ""


@workflow.defn
class ApprovalWorkflow:

    def __init__(self) -> None:
        self._status: str = "RECEIVED"
        self._input: WorkflowInput | None = None
        self._summary: str | None = None
        self._llm_output: dict | None = None
        self._approval: ApprovalSignal | None = None

    # ── Query ───────────────────────────────────────────────

    @workflow.query
    def get_state(self) -> dict:
        approval = None
        if self._approval is not None:
            approval = {
                "approved": self._approval.approved,
                "comment": self._approval.comment,
                "decided_by": self._approval.decided_by,
            }
        input_data = None
        if self._input is not None:
            input_data = {
                "title": self._input.title,
                "body": self._input.body,
                "submitted_by": self._input.submitted_by,
            }
        return {
            "status": self._status,
            "input": input_data,
            "summary": self._summary,
            "llm_output": self._llm_output,
            "approval": approval,
        }

    # ── Signal ──────────────────────────────────────────────

    @workflow.signal
    async def approve(self, signal: ApprovalSignal) -> None:
        self._approval = signal

    # ── Run ─────────────────────────────────────────────────

    @workflow.run
    async def run(self, raw_input: WorkflowInput) -> dict:
        wf_id = workflow.info().workflow_id

        # 1. Normalize input (activity)
        clean = await workflow.execute_activity(
            normalize_input,
            raw_input,
            start_to_close_timeout=timedelta(seconds=30),
        )
        self._input = clean

        # 2. Call LLM for advisory summary (activity)
        text = f"{clean.title}\n\n{clean.body}"
        # 120 s per attempt: Ollama has 30 s (httpx timeout), then hybrid falls
        # back to Claude (~10-15 s), well within the 120 s window.
        raw_json = await workflow.execute_activity_method(
            LLMSummaryActivities.generate_summary,
            text,
            start_to_close_timeout=timedelta(seconds=120),
        )

        # 3. Validate LLM output against strict schema.
        # Use ApplicationError(non_retryable=True) so Temporal fails the workflow
        # immediately instead of retrying indefinitely on a bad LLM response.
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise ApplicationError(
                f"LLM returned invalid JSON: {exc}", non_retryable=True
            ) from exc

        try:
            output = LLMOutput.model_validate(parsed)
        except Exception as exc:
            raise ApplicationError(
                f"LLM output does not match required schema: {exc}", non_retryable=True
            ) from exc

        if not (0 <= output.confidence_score <= 1):
            raise ApplicationError(
                f"confidence_score {output.confidence_score} outside [0, 1]",
                non_retryable=True,
            )

        self._summary = output.summary
        self._llm_output = output.model_dump()
        self._status = "AWAITING_APPROVAL"

        # 4. Wait for human approval (signal — no polling)
        await workflow.wait_condition(lambda: self._approval is not None)

        decision = "approved" if self._approval.approved else "rejected"

        # Update status immediately on signal receipt so callers can distinguish
        # "still waiting for a human" from "signal received, writing audit record".
        self._status = "APPROVED" if self._approval.approved else "REJECTED"

        # 5. Write immutable audit record (activity)
        input_hash = _canonical_json_hash(
            {"title": clean.title, "body": clean.body, "submitted_by": clean.submitted_by},
        )
        output_hash = _canonical_json_hash(parsed)

        audit = AuditRow(
            workflow_id=wf_id,
            decision=decision,
            decision_comment=self._approval.comment,
            decided_by=self._approval.decided_by,
            input_hash=input_hash,
            output_hash=output_hash,
        )
        await workflow.execute_activity_method(
            AuditActivities.write_audit,
            audit,
            start_to_close_timeout=timedelta(seconds=30),
        )

        self._status = "COMPLETED"

        # 6. Complete
        return {
            "workflow_id": wf_id,
            "status": decision,
            "summary": output.summary,
            "request_type": output.request_type,
            "confidence_score": output.confidence_score,
        }
