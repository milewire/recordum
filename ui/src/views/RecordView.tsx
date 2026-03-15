import type { WorkflowState } from "../types";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

interface Props {
  state: WorkflowState;
  onBack: () => void;
}

export function RecordView({ state }: Props) {
  const approval = state.approval;
  const approved = approval?.approved ?? false;
  const llm = state.llm_output;
  const input = state.input;

  // Strip the prepended "Request Type: ..." line from body for display
  const displayBody = input?.body
    ? input.body.replace(/^Request Type:[^\n]*\n\n?/, "").trim()
    : null;

  return (
    <>
      <div className="record-header">
        <div>
          <div className="record-id">
            {state.workflow_id} · {formatTimestamp(state.close_time)}
          </div>
          <div className="record-title">
            {input?.title || state.summary || state.workflow_id}
          </div>
        </div>
        <span className="immutable-badge">⬡ Immutable Record</span>
      </div>

      {/* AI Summary */}
      {llm && (
        <div className="record-section">
          <div className="record-section-title">AI Summary</div>
          <div className="record-section-body">
            <div className="record-summary-text">{llm.summary}</div>
            {llm.risk_notes && (
              <div className="record-risk">
                <span className="record-risk-label">Risk Notes</span>
                <span className="record-risk-text">{llm.risk_notes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Original Request */}
      {input && (
        <div className="record-section">
          <div className="record-section-title">Original Request</div>
          <div className="record-section-body">
            <div className="record-meta-row">
              <span className="record-meta-key">Submitted by</span>
              <span className="record-meta-val">{input.submitted_by}</span>
            </div>
            {displayBody && (
              <div className="record-body-text">{displayBody}</div>
            )}
          </div>
        </div>
      )}

      {/* Decision */}
      <div className="record-grid">
        <div className="record-field">
          <div className="record-field-label">Decision</div>
          <span className={`decision-stamp ${approved ? "approved" : "rejected"}`}>
            {approved ? "✓ Approved" : "✕ Rejected"}
          </span>
        </div>
        <div className="record-field">
          <div className="record-field-label">Decided By</div>
          <div className="record-field-value">{approval?.decided_by || "—"}</div>
        </div>
        <div className="record-field full">
          <div className="record-field-label">Decision Comment</div>
          <div className="record-field-value">{approval?.comment || "—"}</div>
        </div>
        <div className="record-field">
          <div className="record-field-label">Workflow ID</div>
          <div className="record-field-value mono">{state.workflow_id}</div>
        </div>
        <div className="record-field">
          <div className="record-field-label">Timestamp</div>
          <div className="record-field-value mono">{formatTimestamp(state.close_time)}</div>
        </div>
        <div className="record-field">
          <div className="record-field-label">AI Confidence</div>
          <div className="record-field-value mono">
            {llm?.confidence_score != null
              ? `${Math.round(llm.confidence_score * 100)}% · LOCAL MODEL`
              : "—"}
          </div>
        </div>
      </div>
    </>
  );
}
