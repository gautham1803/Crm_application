"""AgentApproval — HITL gate for agent-drafted content."""

from __future__ import annotations

import enum
import typing
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if typing.TYPE_CHECKING:
    from app.models.agent_run import AgentRun
    from app.models.user import User


class ApprovalType(str, enum.Enum):
    email = "email"
    sms = "sms"
    calendar_event = "calendar_event"
    document = "document"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    edited_and_approved = "edited_and_approved"


class AgentApproval(BaseTenantModel):
    """Human-in-the-loop approval gate for agent-drafted content."""

    __tablename__ = "agent_approvals"

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True
    )
    agent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_tasks.id"), nullable=True
    )

    type: Mapped[ApprovalType] = mapped_column(
        Enum(ApprovalType, name="approval_type", create_constraint=True),
        nullable=False,
    )
    draft_content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    assigned_to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status", create_constraint=True),
        nullable=False,
        default=ApprovalStatus.pending,
        index=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    edited_content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="approvals")
    assigned_to: Mapped["User"] = relationship(
        "User", foreign_keys=[assigned_to_user_id], lazy="selectin"
    )
    decided_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[decided_by_user_id], lazy="selectin"
    )
