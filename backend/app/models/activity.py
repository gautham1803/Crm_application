"""Activity — timeline entries (call, email, sms, note, meeting, task, document_sent)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel


class ActivityType(str, enum.Enum):
    call = "call"
    email = "email"
    sms = "sms"
    note = "note"
    meeting = "meeting"
    task = "task"
    document_sent = "document_sent"


class Activity(BaseTenantModel):
    """Activity / timeline entry for a contact, account, or deal."""

    __tablename__ = "activities"

    type: Mapped[ActivityType] = mapped_column(
        Enum(ActivityType, name="activity_type", create_constraint=True),
        nullable=False,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True, index=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True, index=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True, index=True
    )

    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    contact: Mapped["Contact | None"] = relationship(
        "Contact",
        back_populates="activities",
        foreign_keys=[contact_id],
    )

    # Avoid circular: import-only types
    from app.models.contact import Contact  # noqa: F811 — for type checking in relationship
