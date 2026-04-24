"""User model."""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.team import Team


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    rep = "rep"


class User(BaseTenantModel):
    """Application user scoped to a team."""

    __tablename__ = "users"

    auth0_sub: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=True),
        nullable=False,
        default=UserRole.rep,
    )

    # Relationships
    team: Mapped[Team] = relationship("Team", back_populates="users", lazy="selectin")
