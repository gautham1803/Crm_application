"""Messaging providers — SendGrid (email) + Twilio (SMS) + Stub (testing)."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MessageResult:
    """Result of sending a message."""

    success: bool
    provider: str
    message_id: str | None = None
    error: str | None = None


class MessagingProvider(ABC):
    """Protocol for messaging providers."""

    @abstractmethod
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        *,
        from_email: str | None = None,
    ) -> MessageResult:
        ...

    @abstractmethod
    async def send_sms(
        self,
        to_phone: str,
        body: str,
    ) -> MessageResult:
        ...


class SendGridProvider(MessagingProvider):
    """SendGrid email provider."""

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        *,
        from_email: str | None = None,
    ) -> MessageResult:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            sg = SendGridAPIClient(settings.sendgrid_api_key.get_secret_value())
            message = Mail(
                from_email=from_email or settings.sendgrid_from_email,
                to_emails=to_email,
                subject=subject,
                html_content=body_html,
            )
            response = sg.send(message)
            return MessageResult(
                success=response.status_code in (200, 201, 202),
                provider="sendgrid",
                message_id=response.headers.get("X-Message-Id", ""),
            )
        except Exception as e:
            logger.error(f"SendGrid error: {e}")
            return MessageResult(success=False, provider="sendgrid", error=str(e))

    async def send_sms(self, to_phone: str, body: str) -> MessageResult:
        return MessageResult(
            success=False,
            provider="sendgrid",
            error="SendGrid does not support SMS",
        )


class TwilioProvider(MessagingProvider):
    """Twilio SMS provider."""

    async def send_email(
        self, to_email: str, subject: str, body_html: str, *, from_email: str | None = None
    ) -> MessageResult:
        return MessageResult(
            success=False, provider="twilio", error="Twilio does not support email"
        )

    async def send_sms(self, to_phone: str, body: str) -> MessageResult:
        try:
            from twilio.rest import Client

            client = Client(
                settings.twilio_account_sid,
                settings.twilio_auth_token.get_secret_value(),
            )
            message = client.messages.create(
                body=body,
                messaging_service_sid=settings.twilio_messaging_service_sid,
                to=to_phone,
            )
            return MessageResult(
                success=True,
                provider="twilio",
                message_id=message.sid,
            )
        except Exception as e:
            logger.error(f"Twilio error: {e}")
            return MessageResult(success=False, provider="twilio", error=str(e))


class GmailSMTPProvider(MessagingProvider):
    """SMTP provider for sending emails natively (e.g., Gmail with App Passwords)."""

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        *,
        from_email: str | None = None,
    ) -> MessageResult:
        import smtplib
        from email.message import EmailMessage
        import uuid

        sender = from_email or settings.smtp_username

        msg = EmailMessage()
        msg.set_content(body_html, subtype='html')
        msg['Subject'] = subject
        msg['From'] = sender
        msg['To'] = to_email

        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
                smtp.send_message(msg)
            
            return MessageResult(
                success=True,
                provider="gmail-smtp",
                message_id=str(uuid.uuid4())
            )
        except Exception as e:
            logger.error(f"Gmail SMTP error: {e}")
            return MessageResult(success=False, provider="gmail-smtp", error=str(e))

    async def send_sms(self, to_phone: str, body: str) -> MessageResult:
        return MessageResult(
            success=False, provider="gmail-smtp", error="SMTP does not support SMS"
        )


class StubProvider(MessagingProvider):
    """Stub provider for testing — records calls without sending."""

    def __init__(self) -> None:
        self.sent_emails: list[dict[str, Any]] = []
        self.sent_sms: list[dict[str, Any]] = []

    async def send_email(
        self, to_email: str, subject: str, body_html: str, *, from_email: str | None = None
    ) -> MessageResult:
        self.sent_emails.append({
            "to": to_email, "subject": subject, "body": body_html, "from": from_email
        })
        logger.info(f"[STUB] Email sent to {to_email}: {subject}")
        return MessageResult(success=True, provider="stub", message_id="stub-email-001")

    async def send_sms(self, to_phone: str, body: str) -> MessageResult:
        self.sent_sms.append({"to": to_phone, "body": body})
        logger.info(f"[STUB] SMS sent to {to_phone}: {body[:50]}")
        return MessageResult(success=True, provider="stub", message_id="stub-sms-001")


def get_messaging_provider() -> tuple[MessagingProvider, MessagingProvider]:
    """Return (email_provider, sms_provider)."""
    if settings.smtp_password.get_secret_value():
        email = GmailSMTPProvider()
    elif settings.sendgrid_api_key.get_secret_value():
        email = SendGridProvider()
    else:
        email = StubProvider()

    sms = TwilioProvider() if settings.twilio_account_sid else StubProvider()
    return email, sms
