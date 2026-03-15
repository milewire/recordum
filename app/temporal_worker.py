"""Temporal worker — registers the single workflow and all activities."""

from __future__ import annotations

import asyncio

import asyncpg
from anthropic import AsyncAnthropic
from temporalio.client import Client
from temporalio.worker import Worker

from app.activities.llm_summary import LLMSummaryActivities
from app.activities.normalize_input import normalize_input
from app.activities.write_audit import AuditActivities
from app.settings import settings
from app.workflows.approval_workflow import ApprovalWorkflow


async def main() -> None:
    client = await Client.connect(
        settings.temporal_host,
        namespace=settings.temporal_namespace,
    )

    # Only instantiate the Anthropic client when the provider actually needs it.
    anthropic_client = (
        AsyncAnthropic(api_key=settings.anthropic_api_key)
        if settings.ai_provider in ("anthropic", "hybrid")
        else None
    )

    llm = LLMSummaryActivities(
        provider=settings.ai_provider,
        anthropic_client=anthropic_client,
        anthropic_model=settings.anthropic_model,
        ollama_host=settings.ollama_host,
        ollama_model=settings.ollama_model,
    )

    pool = await asyncpg.create_pool(dsn=settings.postgres_dsn)
    audit = AuditActivities(pool=pool)

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[ApprovalWorkflow],
        activities=[
            normalize_input,
            llm.generate_summary,
            audit.write_audit,
        ],
    )

    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
