"""Account schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    domain: str | None = None
    industry: str | None = None
    size: str | None = None
    annual_revenue: float | None = None
    custom_fields: dict | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    size: str | None = None
    annual_revenue: float | None = None
    custom_fields: dict | None = None


class AccountResponse(BaseModel):
    id: UUID
    team_id: UUID
    name: str
    domain: str | None
    industry: str | None
    size: str | None
    annual_revenue: float | None
    custom_fields: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountDetailResponse(AccountResponse):
    """Account with related contacts and deals rollup."""

    contacts_count: int = 0
    deals_total_amount: float = 0.0
    deals_by_stage: dict[str, float] = {}
