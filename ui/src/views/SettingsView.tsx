import { useEffect, useState } from "react";
import { getAppSettings } from "../api";
import type { AppSettings } from "../types";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic Claude",
  ollama: "Ollama (local)",
  hybrid: "Hybrid — Ollama → Claude fallback",
};

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="settings-row">
      <span className="settings-key">{label}</span>
      <span className={`settings-val${mono ? " settings-val--mono" : ""}`}>{value}</span>
    </div>
  );
}

export function SettingsView() {
  const [cfg, setCfg] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAppSettings()
      .then(setCfg)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="notice">Loading settings…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!cfg) return null;

  return (
    <div className="settings-view">
      <div className="settings-section">
        <div className="settings-section-title">AI Provider</div>
        <div className="settings-card">
          <Row label="Active provider" value={PROVIDER_LABELS[cfg.ai_provider] ?? cfg.ai_provider} />
          <Row label="Ollama host" value={cfg.ollama_host} mono />
          <Row label="Ollama model" value={cfg.ollama_model} mono />
          <Row label="Anthropic model" value={cfg.anthropic_model} mono />
          <Row
            label="Anthropic API key"
            value={cfg.anthropic_key_set ? "••••••••  (set)" : "Not set"}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Temporal</div>
        <div className="settings-card">
          <Row label="Host" value={cfg.temporal_host} mono />
          <Row label="Namespace" value={cfg.temporal_namespace} mono />
          <Row label="Task queue" value={cfg.temporal_task_queue} mono />
        </div>
      </div>

      <p className="settings-hint">
        To change these values, edit <code>.env</code> and restart the API server.
      </p>
    </div>
  );
}
