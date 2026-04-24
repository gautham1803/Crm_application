"""Account — optional B2B entity."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.contact import Contact
    from app.models.deal import Deal


class Account(BaseTenantModel):
    """B2B company entity."""

    __tablename__ = "accounts"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size: Mapped[str | None] = mapped_column(String(100), nullable=True)
    annual_revenue: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)

    # Relationships
    contacts: Mapped[list[Contact]] = relationship(
        "Contact", back_populates="account", lazy="selectin"
    )
    deals: Mapped[list[Deal]] = relationship(
        "Deal", back_populates="account", lazy="selectin"
    )
