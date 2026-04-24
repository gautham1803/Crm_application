"""Contact schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ContactCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., max_length=255)
    phone: str | None = None
    account_id: UUID | None = None
    consent_sms: bool = False
    consent_email: bool = False
    consent_source: str | None = None
    custom_fields: dict | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    account_id: UUID | None = None
    custom_fields: dict | None = None


class ContactResponse(BaseModel):
    id: UUID
    team_id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    account_id: UUID | None
    consent_sms: bool
    consent_email: bool
    consent_source: str | None
    consent_timestamp: datetime | None
    unsubscribed_at: datetime | None
    custom_fields: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class ContactDetailResponse(ContactResponse):
    """Contact with activity timeline, deals, consent history."""

    account_name: str | None = None
    deals_count: int = 0
    activities_count: int = 0


class ConsentRequest(BaseModel):
    """Grant or revoke consent."""

    type: str = Field(..., pattern="^(sms|email)$")
    action: str = Field(..., pattern="^(grant|revoke)$")
    source: str = Field(default="manual")


class ContactFilterParams(BaseModel):
    """Contact list filter parameters."""

    search: str | None = None
    account_id: UUID | None = None
    consent_sms: bool | None = None
    consent_email: bool | None = None
    has_account: bool | None = None
