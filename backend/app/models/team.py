"""Team — tenant root model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class Team(BaseModel):
    """Tenant root. Every other model references team_id → this."""

    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    default_currency: Mapped[str] = mapped_column(String(3), default="USD")
    company_signature_block: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_rule_packs: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        server_default=text("ARRAY['universal']::varchar[]"),
        default=lambda: ["universal"],
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        default=datetime.utcnow,
    )

    # Relationships
    users: Mapped[list[User]] = relationship("User", back_populates="team", lazy="selectin")
