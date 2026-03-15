"""Activity: call LLM for an advisory summary.

The LLM summarizes and extracts — it never decides or recommends.
Returns the raw JSON string; the workflow validates it.

Provider routing (controlled by settings.ai_provider):
  "anthropic" — Claude only
  "ollama"    — local Ollama only via OpenAI-compatible endpoint
  "hybrid"    — Ollama first, falls back to Claude if Ollama is unavailable
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import httpx
from anthropic import AsyncAnthropic
from temporalio import activity

from app.schemas.llm_output import LLM_OUTPUT_SCHEMA

_SYSTEM_PROMPT = """\
You are a document analysis assistant.
Given the text below, produce a JSON object matching this exact schema:

{schema}

Rules:
- Summarize the content factually.
- Extract key facts as string key-value pairs.
- Note any risks you observe.
- Provide a confidence score between 0 and 1.
- Do NOT recommend actions.
- Do NOT make decisions.
- Return ONLY valid JSON. No markdown fences, no commentary."""


@dataclass
class LLMSummaryActivities:
    """Activity holder — provider clients are injected at worker startup."""

    provider: str  # "anthropic" | "ollama" | "hybrid"
    anthropic_client: AsyncAnthropic | None
    anthropic_model: str
    ollama_host: str
    ollama_model: str

    # ── Private helpers ──────────────────────────────────────────────

    async def _call_anthropic(self, system: str, text: str) -> str:
        """Send the request to Claude and return the raw response text."""
        if self.anthropic_client is None:
            raise RuntimeError("Anthropic client not configured")
        response = await self.anthropic_client.messages.create(
            model=self.anthropic_model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": text}],
        )
        return response.content[0].text

    async def _call_ollama(self, system: str, text: str) -> str:
        """Send the request to Ollama's OpenAI-compatible endpoint."""
        url = f"{self.ollama_host}/v1/chat/completions"
        payload = {
            "model": self.ollama_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            "stream": False,
        }
        # Keep well under the Temporal activity timeout so httpx raises
        # httpx.TimeoutException (an Exception) rather than letting Temporal
        # cancel the coroutine with asyncio.CancelledError (BaseException),
        # which the hybrid except-clause can't catch.
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── Activity ─────────────────────────────────────────────────────

    @activity.defn
    async def generate_summary(self, text: str) -> str:
        """Route to the configured LLM provider and return raw JSON string.

        The caller (workflow) is responsible for schema validation.
        """
        system = _SYSTEM_PROMPT.format(
            schema=json.dumps(LLM_OUTPUT_SCHEMA, indent=2),
        )

        if self.provider == "anthropic":
            return await self._call_anthropic(system, text)

        if self.provider == "ollama":
            return await self._call_ollama(system, text)

        # hybrid: try Ollama first, fall back to Claude on any error
        try:
            return await self._call_ollama(system, text)
        except Exception:
            return await self._call_anthropic(system, text)
