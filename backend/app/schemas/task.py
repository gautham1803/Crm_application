"""Task schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    due_at: datetime | None = None
    assigned_to_user_id: UUID
    contact_id: UUID | None = None
    deal_id: UUID | None = None
    ai_proposed: bool = False


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    assigned_to_user_id: UUID | None = None
    status: str | None = Field(None, pattern="^(pending|done|cancelled)$")


class TaskResponse(BaseModel):
    id: UUID
    team_id: UUID
    title: str
    description: str | None
    due_at: datetime | None
    assigned_to_user_id: UUID
    assigned_to_name: str | None = None
    contact_id: UUID | None
    deal_id: UUID | None
    status: str
    ai_proposed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
