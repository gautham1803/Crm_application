"""AgentRun — top-level AI agent execution."""

from __future__ import annotations

import enum
import typing
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseTenantModel

if typing.TYPE_CHECKING:
    from app.models.agent_task import AgentTask
    from app.models.agent_approval import AgentApproval


class AgentRunStatus(str, enum.Enum):
    running = "running"
    awaiting_approval = "awaiting_approval"
    complete = "complete"
    failed = "failed"


class AgentRun(BaseTenantModel):
    """Top-level agent run / execution."""

    __tablename__ = "agent_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[AgentRunStatus] = mapped_column(
        Enum(AgentRunStatus, name="agent_run_status", create_constraint=True),
        nullable=False,
        default=AgentRunStatus.running,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_cost_usd: Mapped[float] = mapped_column(
        Numeric(10, 6), default=0.0
    )

    # Relationships
    tasks: Mapped[list["AgentTask"]] = relationship(
        "AgentTask", back_populates="run", lazy="selectin"
    )
    approvals: Mapped[list["AgentApproval"]] = relationship(
        "AgentApproval", back_populates="run", lazy="selectin"
    )
