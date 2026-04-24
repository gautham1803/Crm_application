"""Messaging routes — send emails (SendGrid) and SMS (Twilio) after approval."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.auth import CurrentUser, get_current_user
from app.providers.messaging import get_messaging_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messaging")


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    from_email: Optional[str] = None


class SendSMSRequest(BaseModel):
    to: str
    body: str


class SendResponse(BaseModel):
    success: bool
    provider: str
    message_id: Optional[str] = None
    error: Optional[str] = None


@router.post("/email", response_model=SendResponse, status_code=status.HTTP_200_OK)
async def send_email(
    data: SendEmailRequest,
    user: CurrentUser = Depends(get_current_user),
) -> SendResponse:
    """Send an email via SendGrid."""
    email_provider, _ = get_messaging_provider()

    # Convert plain text body to HTML (preserve line breaks)
    html_body = data.body.replace("\n", "<br>")
    html_body = f"<div style='font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;'>{html_body}</div>"

    result = await email_provider.send_email(
        to_email=data.to,
        subject=data.subject,
        body_html=html_body,
        from_email=data.from_email,
    )

    if result.success:
        logger.info(f"Email sent to {data.to} | subject: {data.subject} | id: {result.message_id}")
    else:
        logger.warning(f"Email failed to {data.to}: {result.error}")

    return SendResponse(
        success=result.success,
        provider=result.provider,
        message_id=result.message_id,
        error=result.error,
    )


@router.post("/sms", response_model=SendResponse, status_code=status.HTTP_200_OK)
async def send_sms(
    data: SendSMSRequest,
    user: CurrentUser = Depends(get_current_user),
) -> SendResponse:
    """Send an SMS via Twilio."""
    _, sms_provider = get_messaging_provider()

    # Normalize phone number to E.164
    phone = data.to.strip()
    if not phone.startswith("+"):
        digits = "".join(c for c in phone if c.isdigit())
        if len(digits) == 10:
            phone = f"+91{digits}"  # Default to India
        elif len(digits) == 11 and digits.startswith("1"):
            phone = f"+{digits}"  # US
        else:
            phone = f"+{digits}"

    result = await sms_provider.send_sms(to_phone=phone, body=data.body)

    if result.success:
        logger.info(f"SMS sent to {phone} | id: {result.message_id}")
    else:
        logger.warning(f"SMS failed to {phone}: {result.error}")

    return SendResponse(
        success=result.success,
        provider=result.provider,
        message_id=result.message_id,
        error=result.error,
    )
