"""Activity: write an immutable audit record to Postgres.

INSERT only — no updates, no upserts. Once written, a row is final.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import asyncpg
from temporalio import activity

_INSERT = """\
INSERT INTO audit_log
    (workflow_id, decision, decision_comment, decided_by,
     decision_timestamp, input_hash, output_hash)
VALUES ($1, $2, $3, $4, $5, $6, $7)"""


@dataclass
class AuditRow:
    """Matches the audit_log table columns (minus the auto-id)."""

    workflow_id: str
    decision: str
    decision_comment: str
    decided_by: str
    input_hash: str
    output_hash: str


@dataclass
class AuditActivities:
    """Activity holder — the connection pool is injected at worker startup."""

    pool: asyncpg.Pool

    @activity.defn
    async def write_audit(self, row: AuditRow) -> None:
        """INSERT one immutable row. Never updates existing rows."""

        async with self.pool.acquire() as conn:
            await conn.execute(
                _INSERT,
                row.workflow_id,
                row.decision,
                row.decision_comment,
                row.decided_by,
                datetime.now(timezone.utc),
                row.input_hash,
                row.output_hash,
            )
