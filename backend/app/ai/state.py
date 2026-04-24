"""Agent state — shared state model for the LangGraph supervisor graph."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AgentState(BaseModel):
    """State passed through the LangGraph supervisor graph."""

    team_id: UUID
    user_id: UUID
    run_id: UUID
    goal: str
    context: dict[str, Any] = Field(default_factory=dict)

    # Scratchpad for agent reasoning
    scratchpad: list[dict[str, Any]] = Field(default_factory=list)

    # Actions proposed by agents
    proposed_actions: list[dict[str, Any]] = Field(default_factory=list)

    # Compliance check results
    compliance_results: list[dict[str, Any]] = Field(default_factory=list)

    # Approval UUIDs pending human review
    pending_approvals: list[UUID] = Field(default_factory=list)

    # Current status
    status: Literal["running", "awaiting_approval", "complete", "failed"] = "running"

    # Error message if failed
    error: str | None = None

    # Current agent being executed
    current_agent: str | None = None

    # Results from each agent step
    agent_results: dict[str, Any] = Field(default_factory=dict)
