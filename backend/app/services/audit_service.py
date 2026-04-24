"""Audit service — transactional audit log helper."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def write_audit_log(
    session: AsyncSession,
    *,
    team_id: UUID,
    action: str,
    entity_type: str,
    entity_id: UUID,
    user_id: UUID | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    agent_run_id: UUID | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Write an audit log entry. Must be called within the same session/transaction."""
    audit = AuditLog(
        team_id=team_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=before_state,
        after_state=after_state,
        agent_run_id=agent_run_id,
        ip_address=ip_address,
    )
    session.add(audit)
    await session.flush()
    return audit
