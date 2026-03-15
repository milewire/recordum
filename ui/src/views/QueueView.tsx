import type { WorkflowListItem } from "../types";

function age(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function statusPill(
  status: WorkflowListItem["status"],
): "awaiting" | "completed" | "rejected" | "failed" {
  if (status === "COMPLETED" || status === "APPROVED") return "completed";
  if (status === "REJECTED") return "rejected";
  if (status === "FAILED") return "failed";
  return "awaiting";
}

function statusLabel(status: WorkflowListItem["status"]): string {
  if (status === "COMPLETED") return "✓ COMPLETED";
  if (status === "APPROVED") return "✓ APPROVED";
  if (status === "REJECTED") return "✕ REJECTED";
  if (status === "AWAITING_APPROVAL") return "● AWAITING";
  if (status === "FAILED") return "✕ FAILED";
  return "● PENDING";
}

interface Props {
  items: WorkflowListItem[];
  onView: (id: string) => void;
  emptyLabel: string;
}

export function QueueView({ items, onView, emptyLabel }: Props) {
  const pendingCount = items.filter((w) => w.status !== "COMPLETED").length;

  return (
    <>
      <div className="queue-header">
        <span className="queue-title">Approval Queue</span>
        <span className="queue-count">
          {items.length} items · {pendingCount} pending
        </span>
      </div>
      <table className="queue-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Request</th>
            <th>Type</th>
            <th>Status</th>
            <th>Confidence</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr className="empty-row">
              <td colSpan={6}>{emptyLabel}</td>
            </tr>
          )}
          {items.map((w) => (
            <tr
              key={w.workflow_id}
              onClick={() => onView(w.workflow_id)}
            >
              <td>
                <span className="item-id">{w.workflow_id}</span>
              </td>
              <td>
                <div className="item-title">{w.title ?? w.workflow_id}</div>
                <div className="item-sub">{w.workflow_id}</div>
              </td>
              <td>
                <span className="item-sub">{w.request_type ?? "—"}</span>
              </td>
              <td>
                <span className={`status-pill ${statusPill(w.status)}`}>
                  {statusLabel(w.status)}
                </span>
              </td>
              <td>
                <span className="item-sub">
                  {w.confidence_score != null
                    ? `${Math.round(w.confidence_score * 100)}%`
                    : "—"}
                </span>
              </td>
              <td>
                <span className="item-sub">{age(w.start_time)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
