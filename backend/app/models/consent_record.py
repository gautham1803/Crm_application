"""ConsentRecord — immutable log of consent grants/revocations."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel


class ConsentType(str, enum.Enum):
    sms = "sms"
    email = "email"


class ConsentAction(str, enum.Enum):
    grant = "grant"
    revoke = "revoke"


class ConsentRecord(BaseModel):
    """Immutable consent log — never update, only insert."""

    __tablename__ = "consent_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        default=uuid.uuid4,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    type: Mapped[ConsentType] = mapped_column(
        Enum(ConsentType, name="consent_type", create_constraint=True),
        nullable=False,
    )
    action: Mapped[ConsentAction] = mapped_column(
        Enum(ConsentAction, name="consent_action", create_constraint=True),
        nullable=False,
    )
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=datetime.utcnow,
    )

    # Relationships
    contact: Mapped["Contact"] = relationship("Contact", back_populates="consent_records")

    from app.models.contact import Contact  # noqa: F811
