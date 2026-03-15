-- Recordum: immutable audit log
-- No UPDATE or DELETE should ever be run against this table.

CREATE TABLE IF NOT EXISTS audit_log (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workflow_id         TEXT        NOT NULL,
    decision            TEXT        NOT NULL CHECK (decision IN ('approved', 'rejected')),
    decision_comment    TEXT        NOT NULL DEFAULT '',
    decided_by          TEXT        NOT NULL DEFAULT '',
    decision_timestamp  TIMESTAMPTZ NOT NULL,
    input_hash          TEXT        NOT NULL,
    output_hash         TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_workflow_id ON audit_log (workflow_id);
