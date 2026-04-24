"""Product schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str | None = None
    description: str | None = None
    price: float = Field(..., ge=0)
    currency: str = "USD"
    custom_fields: dict | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    description: str | None = None
    price: float | None = Field(None, ge=0)
    currency: str | None = None
    custom_fields: dict | None = None


class ProductResponse(BaseModel):
    id: UUID
    team_id: UUID
    name: str
    sku: str | None
    description: str | None
    price: float
    currency: str
    custom_fields: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
