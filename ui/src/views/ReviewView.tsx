import { useState } from "react";
import { approveWorkflow } from "../api";
import type { WorkflowState } from "../types";

interface Props {
  state: WorkflowState;
  onBack: () => void;
  onDecisionSent: () => void;
}

export function ReviewView({ state, onBack, onDecisionSent }: Props) {
  const [comment, setComment] = useState("");
  const [decidedBy, setDecidedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<boolean | null>(null);

  const llm = state.llm_output;
  const confidence = llm?.confidence_score ?? 0;
  const confidencePct = Math.round(confidence * 100);

  const canSubmit = comment.trim() !== "" && decidedBy.trim() !== "";

  const handleDecide = (approved: boolean) => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setDecided(approved);
    approveWorkflow(state.workflow_id, approved, comment.trim(), decidedBy.trim())
      .then(() => onDecisionSent())
      .catch((e) => {
        setError(String(e));
        setSubmitting(false);
        setDecided(null);
      });
  };

  return (
    <div className="review-layout">
      {/* LEFT — AI Context */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-label">AI Context</span>
          <span className="ai-badge">ADVISORY ONLY · LOCAL MODEL</span>
        </div>
        <div className="panel-body">
          <div className="summary-text">
            {llm?.summary ?? state.summary ?? "—"}
          </div>

          {llm?.extracted_facts &&
            Object.keys(llm.extracted_facts).length > 0 && (
              <div className="facts-grid">
                {Object.entries(llm.extracted_facts).map(([k, v]) => (
                  <div key={k} className="fact-row">
                    <span className="fact-key">{k}</span>
                    <span className="fact-val">{v}</span>
                  </div>
                ))}
              </div>
            )}

          <div className="risk-block">
            <div className="risk-label">Risk Notes</div>
            <div className="risk-text">
              {llm?.risk_notes || "None noted."}
            </div>
          </div>

          <div className="score-row">
            <span className="score-label">CONFIDENCE</span>
            <span className="score-value">{confidencePct}</span>
            <div className="score-bar" data-score-pct={confidencePct}>
              <div className="score-fill" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Decision */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-label">Your Decision</span>
        </div>
        <div className="panel-body">
          <div className="decision-notice">
            <span className="notice-icon">⬡</span>
            This decision will be permanently recorded
          </div>

          <div className="field-label">Your Name</div>
          <input
            className="field-input"
            type="text"
            placeholder="Name of the person making this decision"
            value={decidedBy}
            onChange={(e) => setDecidedBy(e.target.value)}
            disabled={submitting}
            maxLength={100}
          />

          <div className="field-label field-label--spaced">Required Comment</div>
          <textarea
            className="field-textarea"
            placeholder="Document your reasoning. This becomes part of the permanent record."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
          />

          {error && <div className="review-error">{error}</div>}

          {!decided && !submitting ? (
            <>
              <div className="decision-buttons">
                <button
                  type="button"
                  className="btn-approve"
                  onClick={() => handleDecide(true)}
                  disabled={!canSubmit}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  onClick={() => handleDecide(false)}
                  disabled={!canSubmit}
                >
                  ✕ Reject
                </button>
              </div>
              <div className="submit-note">
                The AI does not decide anything here.
                <br />
                All decisions are explicitly human.
              </div>
            </>
          ) : submitting && decided !== null ? (
            <div
              className={`submit-note ${decided ? "submitting-approved" : "submitting-rejected"}`}
            >
              {decided
                ? "✓ Approved — writing record..."
                : "✕ Rejected — writing record..."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
