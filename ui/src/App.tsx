import { useCallback, useEffect, useState } from "react";
import { getWorkflow, listWorkflows } from "./api";
import type { WorkflowListItem, WorkflowState } from "./types";
import { AuditLogView } from "./views/AuditLogView";
import { NewRequestModal } from "./views/NewRequestModal";
import { QueueView } from "./views/QueueView";
import { RecordView } from "./views/RecordView";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";

type Nav = "queue" | "history" | "audit" | "settings";

export function App() {
  const [nav, setNav] = useState<Nav>("queue");
  const [items, setItems] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNewRequest, setShowNewRequest] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listWorkflows()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    getWorkflow(id)
      .then(setDetail)
      .catch((e) => setDetailError(String(e)))
      .finally(() => setDetailLoading(false));
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    refresh();
  }, [refresh]);

  // Called by ReviewView once the approve/reject POST returns.
  // Temporal acknowledges the signal immediately — the worker processes it
  // asynchronously. Poll getWorkflow until the status leaves AWAITING_APPROVAL,
  // then let the natural isRecord/isReview logic switch to RecordView.
  const handleDecisionSent = useCallback(
    (id: string) => {
      const poll = () => {
        getWorkflow(id)
          .then((s) => {
            if (s.status === "AWAITING_APPROVAL") {
              setTimeout(poll, 700);
            } else {
              setDetail(s);
            }
          })
          .catch(() => closeDetail());
      };
      poll();
    },
    [closeDetail],
  );

  const terminalStatuses = new Set(["COMPLETED", "APPROVED", "REJECTED"]);
  const pendingCount = items.filter(
    (w) => !terminalStatuses.has(w.status)
  ).length;
  const queueItems =
    nav === "queue"
      ? items.filter((w) => !terminalStatuses.has(w.status))
      : items.filter((w) => terminalStatuses.has(w.status));

  const isReview = selectedId && detail?.status === "AWAITING_APPROVAL";
  const isRecord =
    selectedId &&
    (detail?.status === "COMPLETED" ||
      detail?.status === "APPROVED" ||
      detail?.status === "REJECTED");
  const isOtherDetail =
    selectedId && detail && !isReview && !isRecord;

  // Poll every 2 s while the LLM worker is still processing
  // (status is RECEIVED or similar pre-approval states).
  useEffect(() => {
    if (!isOtherDetail || !detail) return;
    const terminalOrActionable = new Set([
      "COMPLETED", "APPROVED", "REJECTED", "AWAITING_APPROVAL", "FAILED",
    ]);
    if (terminalOrActionable.has(detail.status)) return;
    const timer = setTimeout(() => {
      getWorkflow(detail.workflow_id)
        .then(setDetail)
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [isOtherDetail, detail]);

  const renderContent = () => {
    if (selectedId && !detail && detailLoading) {
      return <p className="notice">Loading…</p>;
    }
    if (selectedId && detailError) {
      return (
        <div>
          <p className="error">{detailError}</p>
          <button className="btn" onClick={closeDetail}>
            ← Back
          </button>
        </div>
      );
    }
    if (isRecord && detail) {
      return (
        <RecordView state={detail} onBack={closeDetail} />
      );
    }
    if (isReview && detail) {
      return (
        <ReviewView
          state={detail}
          onBack={closeDetail}
          onDecisionSent={() => handleDecisionSent(detail.workflow_id)}
        />
      );
    }
    if (isOtherDetail && detail) {
      return (
        <div className="processing-state">
          <p className="processing-id">{detail.workflow_id}</p>
          <p className="processing-label">AI is analyzing the request…</p>
          <p className="processing-sub">
            Status: {detail.status} · This page refreshes automatically.
          </p>
          <button className="btn processing-back" onClick={closeDetail}>
            ← Back to queue
          </button>
        </div>
      );
    }

    if (nav === "audit") return <AuditLogView />;
    if (nav === "settings") return <SettingsView />;

    if (loading) return <p className="notice">Loading…</p>;
    if (error) return <p className="error">{error}</p>;

    return (
      <QueueView
        items={queueItems}
        onView={openDetail}
        emptyLabel={
          nav === "queue"
            ? "No pending requests."
            : "No decisions recorded."
        }
      />
    );
  };

  const selectedItem = items.find((i) => i.workflow_id === selectedId);

  const topbarTitle =
    isReview && detail
      ? selectedItem?.title ?? detail.workflow_id
      : isRecord && detail
        ? "Decision Record"
        : nav === "queue"
          ? "Pending Queue"
          : nav === "history"
            ? "Decision Records"
            : nav === "audit"
              ? "Audit Log"
              : "Settings";
  const topbarMeta =
    isReview && detail
      ? detail.workflow_id
      : isRecord && detail
        ? `${detail.workflow_id} · Immutable`
        : nav === "queue"
          ? `${pendingCount} awaiting review`
          : nav === "history"
            ? `${queueItems.length} items`
            : nav === "audit"
              ? "Immutable decision records"
              : "Application configuration";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-name">Recordum</div>
          <div className="brand-sub">Decision Ledger · v0.1</div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">Workflows</div>
          <button
            type="button"
            className={`nav-item ${(nav === "queue" || isReview) ? "active" : ""}`}
            onClick={() => {
              setNav("queue");
              setSelectedId(null);
            }}
          >
            <span>▪</span> Pending Queue
            <span className="nav-badge">{pendingCount}</span>
          </button>
          <button
            type="button"
            className={`nav-item ${nav === "history" || isRecord ? "active" : ""}`}
            onClick={() => {
              setNav("history");
              setSelectedId(null);
            }}
          >
            <span>▪</span> Decision Records
          </button>
          <div className="nav-section">System</div>
          <button
            type="button"
            className={`nav-item ${nav === "audit" ? "active" : ""}`}
            onClick={() => { setNav("audit"); setSelectedId(null); }}
          >
            <span>▪</span> Audit Log
          </button>
          <button
            type="button"
            className={`nav-item ${nav === "settings" ? "active" : ""}`}
            onClick={() => { setNav("settings"); setSelectedId(null); }}
          >
            <span>▪</span> Settings
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-dot" />
            local · ollama · temporal
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{topbarTitle}</span>
          <span className="topbar-meta">{topbarMeta}</span>
          <div className="topbar-right">
            {(isReview || isRecord) && (
              <button className="btn" onClick={closeDetail}>
                ← Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewRequest(true)}
            >
              + New Request
            </button>
          </div>
        </div>

        <div className="content scrollable">{renderContent()}</div>
      </div>

      {showNewRequest && (
        <NewRequestModal
          onClose={() => setShowNewRequest(false)}
          onSuccess={(workflowId) => {
            setShowNewRequest(false);
            setNav("queue");
            setSelectedId(null);
            refresh();
            // Open the new workflow detail once the list refreshes
            setTimeout(() => openDetail(workflowId), 800);
          }}
        />
      )}
    </div>
  );
}
