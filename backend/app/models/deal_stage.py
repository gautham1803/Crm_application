"""DealStage — per-team customizable pipeline stages."""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseTenantModel


class DealStage(BaseTenantModel):
    """Pipeline stage (per-team, orderable)."""

    __tablename__ = "deal_stages"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False)
