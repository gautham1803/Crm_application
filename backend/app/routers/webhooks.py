"""Webhook handlers for Twilio (SMS) and SendGrid (email events)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.events import event_bus

router = APIRouter(prefix="/webhooks")
logger = logging.getLogger(__name__)


@router.post("/twilio", status_code=status.HTTP_200_OK)
async def twilio_inbound_sms(
    request: Request,
    From: str = Form(default=""),
    To: str = Form(default=""),
    Body: str = Form(default=""),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Handle inbound SMS from Twilio.

    - Parses STOP → writes ConsentRecord revocation
    - Parses inbound message → emits message.received event
    """
    # TODO: Verify X-Twilio-Signature in production
    body_upper = Body.strip().upper()

    if body_upper in ("STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"):
        # Find contact by phone and revoke SMS consent
        from sqlalchemy import select
        from app.models.contact import Contact
        from app.services.consent_service import revoke_consent

        result = await session.execute(
            select(Contact).where(Contact.phone == From)
        )
        contact = result.scalars().first()

        if contact:
            await revoke_consent(
                session,
                contact_id=contact.id,
                team_id=contact.team_id,
                consent_type="sms",
                source="twilio_stop",
            )
            await event_bus.publish(
                "message.consent_revoked",
                {"contact_id": str(contact.id), "type": "sms", "source": "twilio_stop"},
                team_id=contact.team_id,
            )
            logger.info(f"SMS consent revoked for contact {contact.id} via STOP")
        else:
            logger.warning(f"STOP message from unknown phone: {From}")

        return {"status": "consent_revoked"}

    # Regular inbound message
    await event_bus.publish(
        "message.received",
        {"from": From, "to": To, "body": Body, "channel": "sms"},
    )
    logger.info(f"Inbound SMS from {From}: {Body[:50]}...")
    return {"status": "received"}


@router.post("/sendgrid", status_code=status.HTTP_200_OK)
async def sendgrid_email_events(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Handle SendGrid email events (unsubscribe, bounce, etc.)."""
    # TODO: Verify SendGrid webhook signature in production
    try:
        events = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(events, list):
        events = [events]

    for event in events:
        event_type = event.get("event", "")
        email = event.get("email", "")

        if event_type in ("unsubscribe", "group_unsubscribe", "spamreport"):
            from sqlalchemy import select
            from app.models.contact import Contact
            from app.services.consent_service import revoke_consent

            result = await session.execute(
                select(Contact).where(Contact.email == email)
            )
            contact = result.scalars().first()

            if contact:
                await revoke_consent(
                    session,
                    contact_id=contact.id,
                    team_id=contact.team_id,
                    consent_type="email",
                    source=f"sendgrid_{event_type}",
                )
                await event_bus.publish(
                    "message.consent_revoked",
                    {"contact_id": str(contact.id), "type": "email", "source": f"sendgrid_{event_type}"},
                    team_id=contact.team_id,
                )
                logger.info(f"Email consent revoked for {email} via SendGrid {event_type}")

    return {"status": "processed"}
