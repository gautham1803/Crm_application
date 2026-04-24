"""Activity schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityCreate(BaseModel):
    type: str = Field(
        ..., pattern="^(call|email|sms|note|meeting|task|document_sent)$"
    )
    contact_id: UUID | None = None
    account_id: UUID | None = None
    deal_id: UUID | None = None
    subject: str | None = None
    body: str | None = None
    occurred_at: datetime | None = None
    ai_generated: bool = False


class ActivityResponse(BaseModel):
    id: UUID
    team_id: UUID
    type: str
    contact_id: UUID | None
    account_id: UUID | None
    deal_id: UUID | None
    subject: str | None
    body: str | None
    occurred_at: datetime
    ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityFilterParams(BaseModel):
    contact_id: UUID | None = None
    account_id: UUID | None = None
    deal_id: UUID | None = None
    type: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
