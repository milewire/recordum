# Recordum

A system of record for human decisions assisted by AI.

AI may summarize, extract, and suggest.  
AI must never decide, act, or execute.  
All final decisions are explicitly human.

## Requirements

- **Python** 3.10+
- **Node.js** 18+ (for the UI)
- **PostgreSQL**
- **Temporal** (CLI + dev server)
- **Ollama** (optional — required for `AI_PROVIDER=ollama` or `hybrid`)

## Architecture

| Layer            | Technology                                               |
|------------------|----------------------------------------------------------|
| Backend          | Python                                                   |
| API              | FastAPI                                                  |
| Frontend         | React + TypeScript + Vite                                |
| Workflow engine  | Temporal (Python SDK)                                    |
| Database         | Postgres                                                 |
| LLM              | Ollama (`gemma3:4b`) · Anthropic Claude · or hybrid      |

## Workflow: ApprovalWorkflow

```text
Input ──▶ normalize ──▶ LLM summary ──▶ validate schema
                                              │
                                    ┌─────────┘
                                    ▼
                            wait for human
                            approval (signal)
                                    │
                              ┌─────┴─────┐
                              ▼           ▼
                           approved    rejected
                              │           │
                              └─────┬─────┘
                                    ▼
                            write audit record
                            (immutable, Postgres)
                                    │
                                    ▼
                                complete
```

1. **Normalize input** — clean whitespace, lowercase submitter (activity)
2. **LLM summary** — advisory only; routed to Ollama, Claude, or hybrid; produces strict JSON with summary, request_type, extracted_facts, risk_notes, confidence_score (activity)
3. **Validate schema** — deterministic Pydantic validation in the workflow; raises on failure
4. **Human approval** — workflow blocks on a Temporal signal; no polling
5. **Write audit** — INSERT-only row in Postgres with input/output hashes (activity)
6. **Complete** — return final status

## API

| Method | Path                     | Description                                             |
| ------ | ------------------------ | ------------------------------------------------------- |
| `GET`  | `/workflows`             | List all workflows with status and start time           |
| `POST` | `/workflow/start`        | Start a new ApprovalWorkflow; returns `workflow_id`     |
| `POST` | `/workflow/{id}/approve` | Send approval signal `{ approved: bool, comment: str }` |
| `GET`  | `/workflow/{id}`         | Return workflow status + LLM summary + original request |
| `GET`  | `/audit`                 | Return all rows from the immutable audit_log table      |
| `GET`  | `/settings`              | Return non-sensitive application configuration          |

## AI provider

Set `AI_PROVIDER` in `.env` to choose the LLM backend:

| Value | Behaviour |
| --- | --- |
| `ollama` | Local Ollama only — no API key needed. Requires Ollama running at `OLLAMA_HOST`. |
| `anthropic` | Anthropic Claude only — requires `ANTHROPIC_API_KEY`. |
| `hybrid` | Ollama by default; falls back to Claude automatically if Ollama is unavailable. |

For Ollama, pull the model once before starting the worker:

```bash
ollama pull gemma3:4b
```

## Quick start — Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac / Windows) or Docker Engine + Compose (Linux).  
Ollama runs natively on the host; everything else runs in containers.

```bash
# 1. Copy env and set secrets
cp .env.example .env
# Edit .env: set AI_PROVIDER, ANTHROPIC_API_KEY if using Claude, POSTGRES_PASSWORD

# 2. Pull Ollama model (if using ollama or hybrid)
ollama pull gemma3:4b

# 3. Start everything
docker compose up --build
```

Open <http://localhost> for the UI. Temporal Web UI is at <http://localhost:8088>.

To run in the background: `docker compose up --build -d`  
To stop: `docker compose down`  
Database data persists in the `postgres-data` Docker volume.

Docker services:

| Service | Image / build | Exposed |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | internal |
| `temporal` | `temporalio/auto-setup:1.26` | `7233` |
| `temporal-ui` | `temporalio/ui:2.34.0` | `8088` |
| `worker` | `Dockerfile` (Python) | internal |
| `api` | `Dockerfile` (Python) | internal |
| `nginx` | `ui/Dockerfile` (React build + nginx) | `80` |

---

## Quick start — local dev (4 terminals)

```bash
# 1. Install backend
pip install -r requirements.txt

# 2. Postgres — create the audit table (schema at project root)
psql -d recordum -f schema.sql

# 3. Temporal dev server
temporal server start-dev

# 4. Environment — copy and fill from example
cp .env.example .env
# Key settings: POSTGRES_DSN, AI_PROVIDER, and ANTHROPIC_API_KEY if using Claude

# 5. Start the worker (terminal 1)
python -m app.temporal_worker

# 6. Start the API (terminal 2)
uvicorn app.api.main:app --reload

# 7. Install and run the frontend (terminal 3)
cd ui && npm install && npm run dev
```

Open <http://localhost:5173> for the UI. The dev server proxies API requests to <http://localhost:8000>.

## Code structure

```text
recordum/
  schema.sql          # Postgres audit table
  .env.example        # Env template (copy to .env)
  requirements.txt
  Dockerfile          # Python image (api + worker)
  nginx.conf          # nginx reverse-proxy config (used by ui/Dockerfile)

  app/
    workflows/
      approval_workflow.py
    activities/
      normalize_input.py
      llm_summary.py      # Ollama / Anthropic / hybrid routing
      write_audit.py
    schemas/
      llm_output.py
    api/
      main.py
    temporal_worker.py
    settings.py

  ui/
    Dockerfile          # Multi-stage: React build → nginx
    src/
      App.tsx           # Layout, sidebar, topbar, routing
      App.css           # Global styles
      api.ts            # listWorkflows, getWorkflow, approveWorkflow, getAuditLog, getAppSettings
      types.ts          # WorkflowState, WorkflowListItem, AuditRecord, AppSettings, etc.
      views/
        QueueView.tsx       # Pending queue / decision records table
        ReviewView.tsx      # AI context + approve/reject + comment
        RecordView.tsx      # Immutable decision record (includes Original Request)
        AuditLogView.tsx    # Tamper-evident audit log with input/output hashes
        NewRequestModal.tsx # Slide-over form to submit a new workflow
        SettingsView.tsx    # Read-only display of active AI provider and Temporal config
    index.html
    vite.config.ts      # Proxy to API on :8000
```

No additional layers, abstractions, or frameworks.
