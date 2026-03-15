export interface LLMOutput {
  summary: string;
  request_type: string;
  extracted_facts: Record<string, string>;
  risk_notes: string;
  confidence_score: number;
}

export interface Approval {
  approved: boolean;
  comment: string;
  decided_by: string;
}

export type WorkflowStatus =
  | "RECEIVED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED";

export interface WorkflowInput {
  title: string;
  body: string;
  submitted_by: string;
}

export interface WorkflowState {
  workflow_id: string;
  status: WorkflowStatus;
  input: WorkflowInput | null;
  summary: string | null;
  llm_output: LLMOutput | null;
  approval: Approval | null;
  start_time: string | null;
  close_time: string | null;
}

export interface WorkflowListItem {
  workflow_id: string;
  status: WorkflowStatus;
  start_time: string | null;
  title?: string | null;
  request_type?: string | null;
  confidence_score?: number | null;
}

export interface AuditRecord {
  id: string;
  workflow_id: string;
  decision: "approved" | "rejected";
  decision_comment: string;
  decided_by: string;
  decision_timestamp: string | null;
  input_hash: string;
  output_hash: string;
}

export interface AppSettings {
  ai_provider: "anthropic" | "ollama" | "hybrid";
  ollama_host: string;
  ollama_model: string;
  anthropic_model: string;
  anthropic_key_set: boolean;
  temporal_host: string;
  temporal_namespace: string;
  temporal_task_queue: string;
}
