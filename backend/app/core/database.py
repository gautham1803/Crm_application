"""Async SQLAlchemy 2.0 engine with RLS support."""

from __future__ import annotations

import contextvars
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any
from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# ── Context var for RLS team isolation ──────────────────────
current_team_id_ctx: contextvars.ContextVar[UUID | None] = contextvars.ContextVar(
    "current_team_id", default=None
)

# ── Engine ──────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=15,
    pool_pre_ping=True,
    echo=settings.is_dev,
)

# ── Session factory ─────────────────────────────────────────
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an AsyncSession with RLS context set."""
    async with async_session_factory() as session:
        team_id = current_team_id_ctx.get()
        if team_id is not None:
            await session.execute(
                text(f"SET LOCAL app.current_team_id = '{team_id}'")
            )
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def audited_transaction(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: UUID,
    team_id: UUID,
    user_id: UUID | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    agent_run_id: UUID | None = None,
    ip_address: str | None = None,
) -> AsyncGenerator[AsyncSession, None]:
    """Context manager ensuring AuditLog is written in the same transaction.

    Usage::

        async with audited_transaction(session, action="deal.stage_changed", ...):
            deal.stage_id = new_stage
            session.add(deal)
    """
    from app.models.audit_log import AuditLog  # avoid circular import

    try:
        yield session
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
    except Exception:
        raise
