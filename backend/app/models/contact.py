"""Contact model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.activity import Activity
    from app.models.consent_record import ConsentRecord
    from app.models.deal import Deal


class Contact(BaseTenantModel):
    """CRM contact — individual person."""

    __tablename__ = "contacts"

    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=True,
        index=True,
    )

    consent_sms: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_email: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    consent_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unsubscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)

    # Relationships
    account: Mapped[Account | None] = relationship("Account", back_populates="contacts")
    activities: Mapped[list[Activity]] = relationship(
        "Activity",
        back_populates="contact",
        lazy="selectin",
        foreign_keys="Activity.contact_id",
    )
    consent_records: Mapped[list[ConsentRecord]] = relationship(
        "ConsentRecord", back_populates="contact", lazy="selectin"
    )
    deals_direct: Mapped[list[Deal]] = relationship(
        "Deal",
        back_populates="contact",
        foreign_keys="Deal.contact_id",
        lazy="selectin",
    )
