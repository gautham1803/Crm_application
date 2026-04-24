"""Contacts CRUD router with consent management."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.events import event_bus
from app.models.activity import Activity
from app.models.contact import Contact
from app.models.deal import Deal
from app.schemas.contact import (
    ContactCreate,
    ContactDetailResponse,
    ContactResponse,
    ContactUpdate,
    ConsentRequest,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.audit_service import write_audit_log
from app.services.consent_service import grant_consent, revoke_consent

router = APIRouter(prefix="/contacts")


@router.get("", response_model=PaginatedResponse[ContactResponse])
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    account_id: UUID | None = None,
    consent_sms: bool | None = None,
    consent_email: bool | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ContactResponse]:
    query = select(Contact).where(Contact.deleted_at.is_(None))
    count_query = select(func.count(Contact.id)).where(Contact.deleted_at.is_(None))

    if search:
        search_filter = or_(
            Contact.first_name.ilike(f"%{search}%"),
            Contact.last_name.ilike(f"%{search}%"),
            Contact.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if account_id:
        query = query.where(Contact.account_id == account_id)
        count_query = count_query.where(Contact.account_id == account_id)

    if consent_sms is not None:
        query = query.where(Contact.consent_sms == consent_sms)
        count_query = count_query.where(Contact.consent_sms == consent_sms)

    if consent_email is not None:
        query = query.where(Contact.consent_email == consent_email)
        count_query = count_query.where(Contact.consent_email == consent_email)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()

    return PaginatedResponse.create(
        items=[ContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{contact_id}", response_model=ContactDetailResponse)
async def get_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ContactDetailResponse:
    contact = await session.get(Contact, contact_id)
    if not contact or contact.deleted_at:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Activity count
    act_result = await session.execute(
        select(func.count(Activity.id)).where(Activity.contact_id == contact_id)
    )
    activities_count = act_result.scalar() or 0

    # Deals count (direct + via DealContactRole)
    deals_result = await session.execute(
        select(func.count(Deal.id)).where(
            Deal.contact_id == contact_id, Deal.deleted_at.is_(None)
        )
    )
    deals_count = deals_result.scalar() or 0

    resp = ContactDetailResponse.model_validate(contact)
    resp.activities_count = activities_count
    resp.deals_count = deals_count
    if contact.account:
        resp.account_name = contact.account.name
    return resp


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ContactResponse:
    contact = Contact(
        team_id=user.team_id,
        **data.model_dump(exclude_unset=True),
    )
    if data.consent_sms or data.consent_email:
        contact.consent_timestamp = datetime.utcnow()

    session.add(contact)
    await session.flush()

    # Write consent records
    if data.consent_sms:
        await grant_consent(
            session,
            contact_id=contact.id,
            team_id=user.team_id,
            consent_type="sms",
            source=data.consent_source or "creation",
        )
    if data.consent_email:
        await grant_consent(
            session,
            contact_id=contact.id,
            team_id=user.team_id,
            consent_type="email",
            source=data.consent_source or "creation",
        )

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="contact.created",
        entity_type="contact",
        entity_id=contact.id,
        after_state=data.model_dump(mode="json"),
    )

    # Emit event
    await event_bus.publish(
        "contact.created",
        {"contact_id": str(contact.id)},
        team_id=user.team_id,
    )

    await session.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ContactResponse:
    contact = await session.get(Contact, contact_id)
    if not contact or contact.deleted_at:
        raise HTTPException(status_code=404, detail="Contact not found")

    before = {"first_name": contact.first_name, "last_name": contact.last_name, "email": contact.email}
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="contact.updated",
        entity_type="contact",
        entity_id=contact_id,
        before_state=before,
        after_state=data.model_dump(mode="json", exclude_unset=True),
    )

    await session.flush()
    await session.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    contact = await session.get(Contact, contact_id)
    if not contact or contact.deleted_at:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.deleted_at = datetime.utcnow()
    await write_audit_log(
        session,
        team_id=user.team_id,
        action="contact.deleted",
        entity_type="contact",
        entity_id=contact_id,
    )
    await session.flush()


@router.post("/{contact_id}/consent", response_model=MessageResponse)
async def manage_consent(
    contact_id: UUID,
    data: ConsentRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    """Grant or revoke consent for a contact."""
    contact = await session.get(Contact, contact_id)
    if not contact or contact.deleted_at:
        raise HTTPException(status_code=404, detail="Contact not found")

    ip = request.client.host if request.client else None

    if data.action == "grant":
        await grant_consent(
            session,
            contact_id=contact_id,
            team_id=user.team_id,
            consent_type=data.type,
            source=data.source,
            ip_address=ip,
        )
    else:
        await revoke_consent(
            session,
            contact_id=contact_id,
            team_id=user.team_id,
            consent_type=data.type,
            source=data.source,
            ip_address=ip,
        )
        await event_bus.publish(
            "message.consent_revoked",
            {"contact_id": str(contact_id), "type": data.type},
            team_id=user.team_id,
        )

    return MessageResponse(
        message=f"Consent {data.action}ed for {data.type}",
        id=contact_id,
    )
