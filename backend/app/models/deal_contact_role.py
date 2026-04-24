"""DealContactRole — B2B many-to-many between Deal and Contact."""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if TYPE_CHECKING:
    from app.models.contact import Contact
    from app.models.deal import Deal


class ContactRoleType(str, enum.Enum):
    decision_maker = "decision_maker"
    champion = "champion"
    influencer = "influencer"
    blocker = "blocker"
    end_user = "end_user"


class DealContactRole(BaseTenantModel):
    """Many-to-many relationship between deals and contacts with roles."""

    __tablename__ = "deal_contact_roles"

    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True
    )
    role: Mapped[ContactRoleType] = mapped_column(
        Enum(ContactRoleType, name="contact_role_type", create_constraint=True),
        nullable=False,
    )

    # Relationships
    deal: Mapped[Deal] = relationship("Deal", back_populates="stakeholders")
    contact: Mapped[Contact] = relationship("Contact", lazy="selectin")
