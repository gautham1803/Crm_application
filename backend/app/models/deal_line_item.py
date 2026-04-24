"""DealLineItem — products attached to a deal."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.deal import Deal
    from app.models.product import Product


class DealLineItem(BaseTenantModel):
    """Line item linking a product to a deal."""

    __tablename__ = "deal_line_items"

    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Relationships
    deal: Mapped[Deal] = relationship("Deal", back_populates="line_items")
    product: Mapped[Product] = relationship("Product", lazy="selectin")
