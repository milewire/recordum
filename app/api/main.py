"""FastAPI application — thin HTTP layer over the Temporal workflow."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from temporalio.client import Client, WorkflowExecutionStatus

from app.activities.normalize_input import WorkflowInput
from app.settings import settings
from app.workflows.approval_workflow import ApprovalSignal, ApprovalWorkflow

# ── Singletons ──────────────────────────────────────────────────────

_client: Client | None = None
_pool: asyncpg.Pool | None = None


async def get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace,
        )
    return _client


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(dsn=settings.postgres_dsn)
    return _pool


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await get_client()
    await get_pool()
    yield


app = FastAPI(title="Recordum", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ──────────────────────────────────────


class StartRequest(BaseModel):
    title: str
    body: str
    submitted_by: str


class ApproveRequest(BaseModel):
    approved: bool
    comment: str = ""
    decided_by: str = ""


# ── Routes ──────────────────────────────────────────────────────────


@app.get("/workflows")
async def list_workflows() -> list[dict]:
    """List all workflows in the task queue."""

    client = await get_client()
    results: list[dict] = []

    async for wf in client.list_workflows(
        query=f'TaskQueue = "{settings.temporal_task_queue}"',
    ):
        run_id = getattr(wf, "run_id", None)
        handle = client.get_workflow_handle(wf.id, run_id=run_id)
        title = ""
        request_type: str | None = None
        confidence_score: float | None = None

        try:
            desc = await handle.describe()
            title = (await desc.memo_value("title", "")) or ""
        except Exception:
            pass

        wf_status = "COMPLETED"
        if wf.status == WorkflowExecutionStatus.RUNNING:
            try:
                state = await handle.query(ApprovalWorkflow.get_state)
                wf_status = state["status"]
                llm = state.get("llm_output") or {}
                request_type = llm.get("request_type")
                if "confidence_score" in llm:
                    confidence_score = float(llm["confidence_score"])
            except Exception:
                wf_status = "RECEIVED"
        elif wf.status not in (
            WorkflowExecutionStatus.COMPLETED,
            None,
        ):
            wf_status = "FAILED"
        else:
            try:
                result = await handle.result()
                if isinstance(result, dict):
                    request_type = result.get("request_type")
                    if "confidence_score" in result:
                        confidence_score = float(result["confidence_score"])
            except Exception:
                pass

        results.append({
            "workflow_id": wf.id,
            "status": wf_status,
            "start_time": wf.start_time.isoformat() if wf.start_time else None,
            "title": title or None,
            "request_type": request_type,
            "confidence_score": confidence_score,
        })

    return results


@app.post("/workflow/start", status_code=201)
async def start_workflow(req: StartRequest) -> dict:
    """Start a new ApprovalWorkflow; return its workflow_id."""

    client = await get_client()
    wf_id = f"approval-{uuid.uuid4().hex[:12]}"

    await client.start_workflow(
        ApprovalWorkflow.run,
        WorkflowInput(title=req.title, body=req.body, submitted_by=req.submitted_by),
        id=wf_id,
        task_queue=settings.temporal_task_queue,
        memo={"title": req.title},
    )

    return {"workflow_id": wf_id}


@app.post("/workflow/{workflow_id}/approve")
async def approve_workflow(workflow_id: str, req: ApproveRequest) -> dict:
    """Send the approval signal to a pending workflow."""

    comment = req.comment.strip()
    if not comment:
        raise HTTPException(status_code=400, detail="comment is required")
    assert len(comment) > 0, "approval comment must be non-empty"

    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)

    try:
        await handle.signal(
            ApprovalWorkflow.approve,
            ApprovalSignal(
                approved=req.approved,
                comment=comment,
                decided_by=req.decided_by.strip(),
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"failed to signal workflow {workflow_id}: {exc}",
        ) from exc

    return {
        "workflow_id": workflow_id,
        "action": "approved" if req.approved else "rejected",
    }


@app.get("/workflow/{workflow_id}")
async def get_workflow(workflow_id: str) -> dict:
    """Return workflow state via the get_state query."""

    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)

    try:
        state = await handle.query(ApprovalWorkflow.get_state)
        desc = await handle.describe()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "workflow_id": workflow_id,
        **state,
        "start_time": desc.start_time.isoformat() if desc.start_time else None,
        "close_time": desc.close_time.isoformat() if desc.close_time else None,
    }


@app.get("/audit")
async def list_audit() -> list[dict]:
    """Return all rows from the immutable audit_log table, newest first."""

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id,
                workflow_id,
                decision,
                decision_comment,
                decided_by,
                decision_timestamp,
                input_hash,
                output_hash
            FROM audit_log
            ORDER BY decision_timestamp DESC
            """
        )
    return [
        {
            "id": str(r["id"]),
            "workflow_id": r["workflow_id"],
            "decision": r["decision"],
            "decision_comment": r["decision_comment"],
            "decided_by": r["decided_by"],
            "decision_timestamp": r["decision_timestamp"].isoformat() if r["decision_timestamp"] else None,
            "input_hash": r["input_hash"],
            "output_hash": r["output_hash"],
        }
        for r in rows
    ]


@app.get("/settings")
async def get_settings() -> dict:
    """Return non-sensitive application configuration."""

    return {
        "ai_provider": settings.ai_provider,
        "ollama_host": settings.ollama_host,
        "ollama_model": settings.ollama_model,
        "anthropic_model": settings.anthropic_model,
        "anthropic_key_set": bool(settings.anthropic_api_key),
        "temporal_host": settings.temporal_host,
        "temporal_namespace": settings.temporal_namespace,
        "temporal_task_queue": settings.temporal_task_queue,
    }
