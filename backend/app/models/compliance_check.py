"""ComplianceCheck — records individual rule check results."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseTenantModel


class ComplianceResult(str, enum.Enum):
    passed = "pass"
    fail = "fail"
    warn = "warn"


class ComplianceCheck(BaseTenantModel):
    """Individual compliance rule check result."""

    __tablename__ = "compliance_checks"

    agent_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_tasks.id"), nullable=False, index=True
    )
    rule_pack_id: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_pack_version: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_version: Mapped[str] = mapped_column(String(50), nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    result: Mapped[ComplianceResult] = mapped_column(
        Enum(ComplianceResult, name="compliance_result", create_constraint=True),
        nullable=False,
    )
    violations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
