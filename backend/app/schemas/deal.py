"""Deal schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DealCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: float | None = None
    currency: str = "USD"
    expected_close_date: date | None = None
    probability: float | None = Field(None, ge=0, le=100)
    stage_id: UUID
    contact_id: UUID | None = None
    account_id: UUID | None = None
    owner_user_id: UUID


class DealUpdate(BaseModel):
    name: str | None = None
    amount: float | None = None
    currency: str | None = None
    expected_close_date: date | None = None
    probability: float | None = Field(None, ge=0, le=100)
    contact_id: UUID | None = None
    account_id: UUID | None = None
    owner_user_id: UUID | None = None


class DealStageTransition(BaseModel):
    """Request to move a deal to a new stage."""

    stage_id: UUID


class DealStageResponse(BaseModel):
    id: UUID
    name: str
    position: int
    is_won: bool
    is_lost: bool

    model_config = {"from_attributes": True}


class DealResponse(BaseModel):
    id: UUID
    team_id: UUID
    name: str
    amount: float | None
    currency: str
    expected_close_date: date | None
    probability: float | None
    stage_id: UUID
    stage: DealStageResponse | None = None
    contact_id: UUID | None
    account_id: UUID | None
    owner_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealDetailResponse(DealResponse):
    """Deal with stakeholders, line items, activity count."""

    owner_name: str | None = None
    contact_name: str | None = None
    account_name: str | None = None
    stakeholders: list[StakeholderResponse] = []
    line_items: list[LineItemResponse] = []
    activities_count: int = 0


class StakeholderRequest(BaseModel):
    contact_id: UUID
    role: str = Field(..., pattern="^(decision_maker|champion|influencer|blocker|end_user)$")


class StakeholderResponse(BaseModel):
    id: UUID
    contact_id: UUID
    contact_name: str | None = None
    role: str

    model_config = {"from_attributes": True}


class LineItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1)
    unit_price: float
    currency: str = "USD"


class LineItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str | None = None
    quantity: int
    unit_price: float
    currency: str
    total: float = 0.0

    model_config = {"from_attributes": True}
