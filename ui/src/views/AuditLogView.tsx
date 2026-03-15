import { useEffect, useState } from "react";
import { getAuditLog } from "../api";
import type { AuditRecord } from "../types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function shortHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.slice(0, 12) + "…";
}

export function AuditLogView() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLog()
      .then(setRecords)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="notice">Loading audit log…</p>;
  if (error) return <p className="error">{error}</p>;
  if (records.length === 0)
    return <p className="notice">No audit records yet.</p>;

  return (
    <div className="audit-log">
      <table className="audit-table">
        <thead>
          <tr>
            <th>Workflow</th>
            <th>Decision</th>
            <th>Decided By</th>
            <th>Comment</th>
            <th>Timestamp</th>
            <th>Input hash</th>
            <th>Output hash</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td className="audit-wfid" title={r.workflow_id}>
                {r.workflow_id.replace(/^approval-/, "")}
              </td>
              <td>
                <span className={`audit-badge audit-badge--${r.decision}`}>
                  {r.decision === "approved" ? "Approved" : "Rejected"}
                </span>
              </td>
              <td className="audit-comment">{r.decided_by || "—"}</td>
              <td className="audit-comment">{r.decision_comment || "—"}</td>
              <td className="audit-ts">{fmtDate(r.decision_timestamp)}</td>
              <td className="audit-hash" title={r.input_hash}>
                {shortHash(r.input_hash)}
              </td>
              <td className="audit-hash" title={r.output_hash}>
                {shortHash(r.output_hash)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
