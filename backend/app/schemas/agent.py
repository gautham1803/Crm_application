"""Agent / AI schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentRunCreate(BaseModel):
    goal: str = Field(
        ..., pattern="^(qualify_lead|nurture_deal|research_account|schedule_meeting)$"
    )
    context: dict = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    id: UUID
    team_id: UUID
    user_id: UUID
    goal: str
    context: dict | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    total_cost_usd: float
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentTaskResponse(BaseModel):
    id: UUID
    run_id: UUID
    agent_name: str
    input: dict | None
    output: dict | None
    tool_calls: list | None
    tokens_used: int | None
    cost_usd: float | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class AgentRunDetailResponse(AgentRunResponse):
    tasks: list[AgentTaskResponse] = []


class ApprovalResponse(BaseModel):
    id: UUID
    team_id: UUID
    run_id: UUID
    agent_task_id: UUID | None
    type: str
    draft_content: dict
    reasoning: str | None
    compliance_result: dict | None
    assigned_to_user_id: UUID
    assigned_to_name: str | None = None
    status: str
    decided_at: datetime | None
    decided_by_user_id: UUID | None
    edited_content: dict | None
    expires_at: datetime
    created_at: datetime
    time_remaining_seconds: int | None = None

    # Context
    contact_name: str | None = None
    deal_name: str | None = None

    model_config = {"from_attributes": True}


class ApprovalDecision(BaseModel):
    action: str = Field(
        ..., pattern="^(approve|reject|edit_and_approve)$"
    )
    edited_content: dict | None = None
    feedback: str | None = None


class AuditLogResponse(BaseModel):
    id: UUID
    team_id: UUID
    user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID
    before_state: dict | None
    after_state: dict | None
    agent_run_id: UUID | None
    ip_address: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}
