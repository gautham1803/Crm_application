"""Consent service — grant/revoke consent with immutable ConsentRecord writes."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_record import ConsentAction, ConsentRecord, ConsentType
from app.models.contact import Contact
from app.services.audit_service import write_audit_log


async def grant_consent(
    session: AsyncSession,
    *,
    contact_id: UUID,
    team_id: UUID,
    consent_type: str,
    source: str = "manual",
    ip_address: str | None = None,
    user_id: UUID | None = None,
) -> ConsentRecord:
    """Grant consent (sms or email) and update contact flags."""
    record = ConsentRecord(
        contact_id=contact_id,
        team_id=team_id,
        type=ConsentType(consent_type),
        action=ConsentAction.grant,
        source=source,
        ip_address=ip_address,
    )
    session.add(record)

    # Update contact flag
    contact = await session.get(Contact, contact_id)
    if contact:
        before = {"consent_sms": contact.consent_sms, "consent_email": contact.consent_email}
        if consent_type == "sms":
            contact.consent_sms = True
        elif consent_type == "email":
            contact.consent_email = True
            contact.unsubscribed_at = None
        contact.consent_source = source
        contact.consent_timestamp = datetime.utcnow()

        after = {"consent_sms": contact.consent_sms, "consent_email": contact.consent_email}
        await write_audit_log(
            session,
            team_id=team_id,
            action=f"consent.{consent_type}.grant",
            entity_type="contact",
            entity_id=contact_id,
            user_id=user_id,
            before_state=before,
            after_state=after,
            ip_address=ip_address,
        )

    await session.flush()
    return record


async def revoke_consent(
    session: AsyncSession,
    *,
    contact_id: UUID,
    team_id: UUID,
    consent_type: str,
    source: str = "manual",
    ip_address: str | None = None,
    user_id: UUID | None = None,
) -> ConsentRecord:
    """Revoke consent and update contact flags."""
    record = ConsentRecord(
        contact_id=contact_id,
        team_id=team_id,
        type=ConsentType(consent_type),
        action=ConsentAction.revoke,
        source=source,
        ip_address=ip_address,
    )
    session.add(record)

    contact = await session.get(Contact, contact_id)
    if contact:
        before = {"consent_sms": contact.consent_sms, "consent_email": contact.consent_email}
        if consent_type == "sms":
            contact.consent_sms = False
        elif consent_type == "email":
            contact.consent_email = False
            contact.unsubscribed_at = datetime.utcnow()

        after = {"consent_sms": contact.consent_sms, "consent_email": contact.consent_email}
        await write_audit_log(
            session,
            team_id=team_id,
            action=f"consent.{consent_type}.revoke",
            entity_type="contact",
            entity_id=contact_id,
            user_id=user_id,
            before_state=before,
            after_state=after,
            ip_address=ip_address,
        )

    await session.flush()
    return record


async def get_consent_records(
    session: AsyncSession,
    contact_id: UUID,
) -> list[ConsentRecord]:
    """Get all consent records for a contact."""
    result = await session.execute(
        select(ConsentRecord)
        .where(ConsentRecord.contact_id == contact_id)
        .order_by(ConsentRecord.timestamp.desc())
    )
    return list(result.scalars().all())


async def check_active_consent(
    session: AsyncSession,
    contact_id: UUID,
    consent_type: str,
) -> bool:
    """Check if a contact has active consent of the given type."""
    records = await get_consent_records(session, contact_id)
    type_records = [r for r in records if r.type.value == consent_type]
    if not type_records:
        return False
    # Latest record determines current state
    latest = type_records[0]  # Already ordered by timestamp desc
    return latest.action == ConsentAction.grant
