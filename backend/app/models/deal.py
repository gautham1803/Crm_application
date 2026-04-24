"""Deal model — supports both B2B (account) and B2C (contact) shapes."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.contact import Contact
    from app.models.deal_contact_role import DealContactRole
    from app.models.deal_line_item import DealLineItem
    from app.models.deal_stage import DealStage
    from app.models.user import User


class Deal(BaseTenantModel):
    """Sales deal / opportunity."""

    __tablename__ = "deals"
    __table_args__ = (
        CheckConstraint(
            "contact_id IS NOT NULL OR account_id IS NOT NULL",
            name="ck_deal_contact_or_account",
        ),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    probability: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deal_stages.id"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=True,
        index=True,
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Relationships
    stage: Mapped[DealStage] = relationship("DealStage", lazy="selectin")
    contact: Mapped[Contact | None] = relationship(
        "Contact", back_populates="deals_direct", foreign_keys=[contact_id]
    )
    account: Mapped[Account | None] = relationship(
        "Account", back_populates="deals", foreign_keys=[account_id]
    )
    owner: Mapped[User] = relationship("User", lazy="selectin")
    stakeholders: Mapped[list[DealContactRole]] = relationship(
        "DealContactRole", back_populates="deal", lazy="selectin"
    )
    line_items: Mapped[list[DealLineItem]] = relationship(
        "DealLineItem", back_populates="deal", lazy="selectin"
    )
