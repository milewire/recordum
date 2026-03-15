"""Centralised configuration — loaded from environment / .env file."""

from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Temporal
    temporal_host: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "recordum"

    # AI provider routing
    # "anthropic" — Claude only (requires ANTHROPIC_API_KEY)
    # "ollama"    — local Ollama only (no API key needed)
    # "hybrid"    — Ollama by default, falls back to Claude if Ollama is down
    ai_provider: Literal["anthropic", "ollama", "hybrid"] = "anthropic"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"

    # Anthropic (used when ai_provider is "anthropic" or "hybrid")
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Postgres
    postgres_dsn: str = "postgresql://localhost:5432/recordum"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000


settings = Settings()
