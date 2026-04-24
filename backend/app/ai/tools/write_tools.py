"""Write tools — internal CRM mutations by agents (no HITL needed)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.core.database import async_session_factory, current_team_id_ctx
from app.models.account import Account
from app.models.activity import Activity, ActivityType
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.memory_chunk import MemoryChunk, MemorySource
from app.models.task import Task
from app.services.audit_service import write_audit_log


async def _get_session(team_id: UUID):  # type: ignore[no-untyped-def]
    session = async_session_factory()
    current_team_id_ctx.set(team_id)
    await session.execute(text(f"SET LOCAL app.current_team_id = '{team_id}'"))
    return session


async def update_contact(
    team_id: UUID, user_id: UUID, contact_id: UUID, fields: dict[str, Any]
) -> dict[str, Any]:
    """Update contact fields."""
    session = await _get_session(team_id)
    try:
        contact = await session.get(Contact, contact_id)
        if not contact:
            return {"error": "Contact not found"}

        before = {"first_name": contact.first_name, "last_name": contact.last_name}
        for key, value in fields.items():
            if hasattr(contact, key):
                setattr(contact, key, value)

        await write_audit_log(
            session, team_id=team_id, action="contact.updated_by_agent",
            entity_type="contact", entity_id=contact_id,
            user_id=user_id, before_state=before, after_state=fields,
        )
        await session.commit()
        return {"id": str(contact_id), "updated_fields": list(fields.keys())}
    finally:
        await session.close()


async def update_account(
    team_id: UUID, user_id: UUID, account_id: UUID, fields: dict[str, Any]
) -> dict[str, Any]:
    """Update account fields."""
    session = await _get_session(team_id)
    try:
        account = await session.get(Account, account_id)
        if not account:
            return {"error": "Account not found"}

        for key, value in fields.items():
            if hasattr(account, key):
                setattr(account, key, value)

        await write_audit_log(
            session, team_id=team_id, action="account.updated_by_agent",
            entity_type="account", entity_id=account_id,
            user_id=user_id, after_state=fields,
        )
        await session.commit()
        return {"id": str(account_id), "updated_fields": list(fields.keys())}
    finally:
        await session.close()


async def update_deal(
    team_id: UUID, user_id: UUID, deal_id: UUID, fields: dict[str, Any]
) -> dict[str, Any]:
    """Update deal fields."""
    session = await _get_session(team_id)
    try:
        deal = await session.get(Deal, deal_id)
        if not deal:
            return {"error": "Deal not found"}

        for key, value in fields.items():
            if hasattr(deal, key):
                setattr(deal, key, value)

        await write_audit_log(
            session, team_id=team_id, action="deal.updated_by_agent",
            entity_type="deal", entity_id=deal_id,
            user_id=user_id, after_state=fields,
        )
        await session.commit()
        return {"id": str(deal_id), "updated_fields": list(fields.keys())}
    finally:
        await session.close()


async def update_deal_stage(
    team_id: UUID, user_id: UUID, deal_id: UUID, stage_id: UUID
) -> dict[str, Any]:
    """Move deal to a new stage."""
    session = await _get_session(team_id)
    try:
        deal = await session.get(Deal, deal_id)
        if not deal:
            return {"error": "Deal not found"}

        old_stage_id = str(deal.stage_id)
        deal.stage_id = stage_id

        await write_audit_log(
            session, team_id=team_id, action="deal.stage_changed_by_agent",
            entity_type="deal", entity_id=deal_id,
            user_id=user_id,
            before_state={"stage_id": old_stage_id},
            after_state={"stage_id": str(stage_id)},
        )
        await session.commit()
        return {"deal_id": str(deal_id), "new_stage_id": str(stage_id)}
    finally:
        await session.close()


async def create_activity(
    team_id: UUID,
    user_id: UUID,
    *,
    activity_type: str,
    subject: str | None = None,
    body: str | None = None,
    contact_id: UUID | None = None,
    deal_id: UUID | None = None,
) -> dict[str, Any]:
    """Create an activity record."""
    session = await _get_session(team_id)
    try:
        activity = Activity(
            team_id=team_id,
            type=ActivityType(activity_type),
            contact_id=contact_id,
            deal_id=deal_id,
            subject=subject,
            body=body,
            occurred_at=datetime.utcnow(),
            ai_generated=True,
        )
        session.add(activity)
        await session.commit()
        return {"id": str(activity.id), "type": activity_type}
    finally:
        await session.close()


async def create_task(
    team_id: UUID,
    user_id: UUID,
    *,
    title: str,
    assigned_to: UUID,
    due_at: datetime | None = None,
    contact_id: UUID | None = None,
    deal_id: UUID | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """Create a task for a rep."""
    session = await _get_session(team_id)
    try:
        task = Task(
            team_id=team_id,
            title=title,
            description=description,
            due_at=due_at,
            assigned_to_user_id=assigned_to,
            contact_id=contact_id,
            deal_id=deal_id,
            ai_proposed=True,
        )
        session.add(task)
        await session.commit()
        return {"id": str(task.id), "title": title}
    finally:
        await session.close()


from app.ai.llm import generate_embedding

async def store_memory(
    team_id: UUID,
    content: str,
    source: str = "research",
    contact_id: UUID | None = None,
    account_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Store a memory chunk for future retrieval with vector embedding."""
    session = await _get_session(team_id)
    try:
        embedding = await generate_embedding(content)
        
        chunk = MemoryChunk(
            team_id=team_id,
            content=content,
            source=MemorySource(source),
            contact_id=contact_id,
            account_id=account_id,
            metadata_=metadata,
            embedding=embedding,
        )
        session.add(chunk)
        await session.commit()
        return {"id": str(chunk.id), "content_length": len(content)}
    finally:
        await session.close()
