import { useEffect, useRef, useState } from "react";
import { startWorkflow } from "../api";

const REQUEST_TYPES = [
  "Change Order Approval",
  "Non-Contract Approval",
  "Policy Exception",
];

interface Props {
  onClose: () => void;
  onSuccess: (workflowId: string) => void;
}

export function NewRequestModal({ onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [requestType, setRequestType] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Focus title field on open
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  const isValid =
    title.trim() !== "" &&
    submittedBy.trim() !== "" &&
    requestType !== "" &&
    body.trim() !== "";

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    // Prepend the request type so the LLM has full context
    const fullBody = `Request Type: ${requestType}\n\n${body.trim()}`;

    try {
      const result = await startWorkflow({
        title: title.trim(),
        body: fullBody,
        submitted_by: submittedBy.trim(),
      });
      onSuccess(result.workflow_id);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="New Request">
        <div className="modal-header">
          <span className="modal-title">New Request</span>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label" htmlFor="req-title">Title</label>
            <input
              id="req-title"
              ref={titleRef}
              className="modal-input"
              type="text"
              placeholder="Short human-readable name for this request"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="req-submitted-by">Submitted By</label>
            <input
              id="req-submitted-by"
              className="modal-input"
              type="text"
              placeholder="Name or identifier of the requester"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              disabled={submitting}
              maxLength={100}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="req-type">Request Type</label>
            <select
              id="req-type"
              className="modal-select"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select a type…</option>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="modal-field modal-field--grow">
            <label className="modal-label" htmlFor="req-body">
              Request Description
            </label>
            <textarea
              id="req-body"
              className="modal-textarea"
              placeholder="Full description of the request. The AI will analyze this text and produce a summary, extract key facts, and identify risks."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="modal-error">{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </>
  );
}
