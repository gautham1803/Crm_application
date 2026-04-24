"""Pydantic Settings v2 — all configuration from environment variables."""

from __future__ import annotations

import json
from typing import Any

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────
    app_env: str = "development"
    dev_auth_bypass: bool = True

    # ── Auth0 ────────────────────────────────────────────────
    auth0_domain: str = "your-tenant.auth0.com"
    auth0_audience: str = "https://api.acufy.local"
    auth0_client_id: str = "your_client_id"
    auth0_client_secret: SecretStr = SecretStr("your_client_secret")

    # ── Database ─────────────────────────────────────────────
    database_url: str = "postgresql+psycopg://acufy:acufy_secret@localhost:5432/acufy"

    # ── Redis ────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── LLM ──────────────────────────────────────────────────
    # Group 1 — Llama via Groq: LeadQualifier, Research, DealOrchestrator, Compliance
    llm_llama_model: str = "groq/llama-3.3-70b-versatile"
    llm_llama_fast_model: str = "groq/llama-3.1-8b-instant"
    groq_api_key: SecretStr = SecretStr("")

    # Group 2 — Mistral: Nurturer, Scheduler, OpportunityWatch, Proposal
    llm_mistral_model: str = "mistral/mistral-large-latest"
    mistral_api_key: SecretStr = SecretStr("")

    # Shared fallback for both groups
    llm_fallback_model: str = "gemini/gemini-1.5-flash"
    google_api_key: SecretStr = SecretStr("")

    # Legacy aliases kept for backward compat
    llm_default_model: str = "groq/llama-3.3-70b-versatile"
    llm_fast_model: str = "groq/llama-3.1-8b-instant"

    llm_budget_per_team_daily_usd: float = 5.0
    llm_budget_per_user_daily_usd: float = 1.0

    # ── Messaging ────────────────────────────────────────────
    sendgrid_api_key: SecretStr = SecretStr("")
    sendgrid_from_email: str = "noreply@acufy.local"
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    twilio_account_sid: str = ""
    twilio_auth_token: SecretStr = SecretStr("")
    twilio_messaging_service_sid: str = ""

    # ── Storage ──────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "acufy-documents"

    # ── Observability ────────────────────────────────────────
    langfuse_public_key: SecretStr = SecretStr("pk-lf-local")
    langfuse_secret_key: SecretStr = SecretStr("sk-lf-local")
    langfuse_host: str = "http://langfuse-web:3000"

    # ── Compliance ───────────────────────────────────────────
    compliance_rule_packs: list[str] = Field(default=["universal"])

    @field_validator("compliance_rule_packs", mode="before")
    @classmethod
    def _parse_rule_packs(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return json.loads(v)  # type: ignore[no-any-return]
        return v  # type: ignore[return-value]

    @property
    def sync_database_url(self) -> str:
        """Synchronous DB URL for Alembic."""
        return self.database_url.replace("+psycopg", "+psycopg")

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


# Singleton
settings = Settings()
