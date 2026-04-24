"""Product model."""

from __future__ import annotations

from sqlalchemy import Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseTenantModel


class Product(BaseTenantModel):
    """Product catalog item."""

    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
