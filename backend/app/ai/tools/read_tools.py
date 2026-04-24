"""Read tools — CRM data retrieval for agents."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, current_team_id_ctx
from app.models.account import Account
from app.models.contact import Contact
from app.models.consent_record import ConsentRecord, ConsentAction
from app.models.deal import Deal
from app.models.deal_stage import DealStage
from app.models.product import Product
from app.models.memory_chunk import MemoryChunk
from app.services.consent_service import check_active_consent


async def _get_session(team_id: UUID) -> AsyncSession:
    """Create a session with RLS context set."""
    session = async_session_factory()
    current_team_id_ctx.set(team_id)
    from sqlalchemy import text
    await session.execute(text(f"SET LOCAL app.current_team_id = '{team_id}'"))
    return session


async def get_contact(team_id: UUID, contact_id: UUID) -> dict[str, Any]:
    """Get contact with consent records."""
    session = await _get_session(team_id)
    try:
        contact = await session.get(Contact, contact_id)
        if not contact:
            return {"error": "Contact not found"}

        consent_records = await session.execute(
            select(ConsentRecord).where(ConsentRecord.contact_id == contact_id)
        )

        return {
            "id": str(contact.id),
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "phone": contact.phone,
            "account_id": str(contact.account_id) if contact.account_id else None,
            "consent_sms": contact.consent_sms,
            "consent_email": contact.consent_email,
            "custom_fields": contact.custom_fields,
            "consent_records": [
                {"type": r.type.value, "action": r.action.value, "timestamp": r.timestamp.isoformat()}
                for r in consent_records.scalars().all()
            ],
        }
    finally:
        await session.close()


async def search_contacts(team_id: UUID, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search contacts by name or email."""
    session = await _get_session(team_id)
    try:
        result = await session.execute(
            select(Contact)
            .where(
                Contact.deleted_at.is_(None),
                or_(
                    Contact.first_name.ilike(f"%{query}%"),
                    Contact.last_name.ilike(f"%{query}%"),
                    Contact.email.ilike(f"%{query}%"),
                ),
            )
            .limit(limit)
        )
        contacts = result.scalars().all()
        return [
            {
                "id": str(c.id),
                "name": f"{c.first_name} {c.last_name}",
                "email": c.email,
                "phone": c.phone,
                "consent_sms": c.consent_sms,
                "consent_email": c.consent_email,
            }
            for c in contacts
        ]
    finally:
        await session.close()


async def get_account(team_id: UUID, account_id: UUID) -> dict[str, Any]:
    """Get account with contacts and deals."""
    session = await _get_session(team_id)
    try:
        account = await session.get(Account, account_id)
        if not account:
            return {"error": "Account not found"}

        return {
            "id": str(account.id),
            "name": account.name,
            "domain": account.domain,
            "industry": account.industry,
            "size": account.size,
            "annual_revenue": float(account.annual_revenue) if account.annual_revenue else None,
            "contacts": [
                {"id": str(c.id), "name": f"{c.first_name} {c.last_name}", "email": c.email}
                for c in account.contacts if not c.deleted_at
            ],
            "deals": [
                {
                    "id": str(d.id), "name": d.name,
                    "amount": float(d.amount) if d.amount else None,
                    "stage": d.stage.name if d.stage else "Unknown",
                }
                for d in account.deals if not d.deleted_at
            ],
        }
    finally:
        await session.close()


async def get_deal(team_id: UUID, deal_id: UUID) -> dict[str, Any]:
    """Get deal with line items, stakeholders, and history."""
    session = await _get_session(team_id)
    try:
        deal = await session.get(Deal, deal_id)
        if not deal:
            return {"error": "Deal not found"}

        return {
            "id": str(deal.id),
            "name": deal.name,
            "amount": float(deal.amount) if deal.amount else None,
            "currency": deal.currency,
            "stage": deal.stage.name if deal.stage else "Unknown",
            "probability": float(deal.probability) if deal.probability else None,
            "expected_close_date": deal.expected_close_date.isoformat() if deal.expected_close_date else None,
            "owner": deal.owner.name if deal.owner else None,
            "contact": f"{deal.contact.first_name} {deal.contact.last_name}" if deal.contact else None,
            "account": deal.account.name if deal.account else None,
            "stakeholders": [
                {"contact": f"{s.contact.first_name} {s.contact.last_name}", "role": s.role.value}
                for s in deal.stakeholders if s.contact
            ],
            "line_items": [
                {"product": li.product.name if li.product else "Unknown", "qty": li.quantity, "price": float(li.unit_price)}
                for li in deal.line_items
            ],
        }
    finally:
        await session.close()


async def list_deals_by_stage(team_id: UUID, stage_id: UUID) -> list[dict[str, Any]]:
    """List deals in a specific pipeline stage."""
    session = await _get_session(team_id)
    try:
        result = await session.execute(
            select(Deal).where(Deal.stage_id == stage_id, Deal.deleted_at.is_(None))
        )
        deals = result.scalars().all()
        return [
            {"id": str(d.id), "name": d.name, "amount": float(d.amount) if d.amount else None}
            for d in deals
        ]
    finally:
        await session.close()


async def get_product(team_id: UUID, product_id: UUID) -> dict[str, Any]:
    """Get product details."""
    session = await _get_session(team_id)
    try:
        product = await session.get(Product, product_id)
        if not product:
            return {"error": "Product not found"}
        return {
            "id": str(product.id), "name": product.name, "sku": product.sku,
            "description": product.description, "price": float(product.price), "currency": product.currency,
        }
    finally:
        await session.close()


async def search_products(team_id: UUID, query: str) -> list[dict[str, Any]]:
    """Search products by name or SKU."""
    session = await _get_session(team_id)
    try:
        result = await session.execute(
            select(Product)
            .where(
                Product.deleted_at.is_(None),
                or_(Product.name.ilike(f"%{query}%"), Product.sku.ilike(f"%{query}%")),
            )
            .limit(10)
        )
        return [
            {"id": str(p.id), "name": p.name, "sku": p.sku, "price": float(p.price)}
            for p in result.scalars().all()
        ]
    finally:
        await session.close()


async def check_consent(team_id: UUID, contact_id: UUID, consent_type: str) -> dict[str, Any]:
    """Check if contact has active consent of given type."""
    session = await _get_session(team_id)
    try:
        has_consent = await check_active_consent(session, contact_id, consent_type)
        return {"contact_id": str(contact_id), "type": consent_type, "active": has_consent}
    finally:
        await session.close()


from app.ai.llm import generate_embedding

async def retrieve_memory(
    team_id: UUID,
    query: str,
    contact_id: UUID | None = None,
    account_id: UUID | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Retrieve relevant memory chunks via vector search."""
    session = await _get_session(team_id)
    try:
        query_embedding = await generate_embedding(query)
        
        q = select(MemoryChunk).where(MemoryChunk.deleted_at.is_(None))
        if contact_id:
            q = q.where(MemoryChunk.contact_id == contact_id)
        if account_id:
            q = q.where(MemoryChunk.account_id == account_id)

        # Vector similarity search using pgvector cosine_distance
        q = q.order_by(MemoryChunk.embedding.cosine_distance(query_embedding)).limit(limit)

        result = await session.execute(q)
        return [
            {
                "id": str(m.id),
                "content": m.content,
                "source": m.source.value,
                "metadata": m.metadata_,
            }
            for m in result.scalars().all()
        ]
    finally:
        await session.close()
