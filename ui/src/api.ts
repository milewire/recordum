import type { AppSettings, AuditRecord, WorkflowListItem, WorkflowState } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function listWorkflows(): Promise<WorkflowListItem[]> {
  return request("/workflows");
}

export function getWorkflow(id: string): Promise<WorkflowState> {
  return request(`/workflow/${id}`);
}

export function approveWorkflow(
  id: string,
  approved: boolean,
  comment: string,
  decided_by: string,
): Promise<{ workflow_id: string; action: string }> {
  return request(`/workflow/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, comment, decided_by }),
  });
}

export function startWorkflow(data: {
  title: string;
  body: string;
  submitted_by: string;
}): Promise<{ workflow_id: string }> {
  return request("/workflow/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function getAuditLog(): Promise<AuditRecord[]> {
  return request("/audit");
}

export function getAppSettings(): Promise<AppSettings> {
  return request("/settings");
}
