"""Draft tools — create AgentApproval (HITL required) + post-approval execution."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.core.database import async_session_factory, current_team_id_ctx
from app.core.websocket import ws_manager
from app.models.agent_approval import AgentApproval, ApprovalStatus, ApprovalType
from app.models.activity import Activity, ActivityType
from app.providers.messaging import get_messaging_provider
from app.services.audit_service import write_audit_log

logger = logging.getLogger(__name__)


async def _get_session(team_id: UUID):  # type: ignore[no-untyped-def]
    session = async_session_factory()
    current_team_id_ctx.set(team_id)
    await session.execute(text(f"SET LOCAL app.current_team_id = '{team_id}'"))
    return session


# ── Draft tools (create approval, HITL pause) ──────────────

async def draft_email(
    team_id: UUID,
    user_id: UUID,
    run_id: UUID,
    *,
    to_contact_id: UUID,
    subject: str,
    body: str,
    deal_id: UUID | None = None,
    reasoning: str | None = None,
    compliance_result: dict[str, Any] | None = None,
    assigned_to_user_id: UUID | None = None,
) -> dict[str, Any]:
    """Draft an email and create an AgentApproval for rep review."""
    session = await _get_session(team_id)
    try:
        approval = AgentApproval(
            team_id=team_id,
            run_id=run_id,
            type=ApprovalType.email,
            draft_content={
                "to_contact_id": str(to_contact_id),
                "subject": subject,
                "body": body,
                "deal_id": str(deal_id) if deal_id else None,
            },
            reasoning=reasoning,
            compliance_result=compliance_result,
            assigned_to_user_id=assigned_to_user_id or user_id,
            status=ApprovalStatus.pending,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        session.add(approval)
        await session.commit()

        # Notify via WebSocket
        await ws_manager.publish_approval_created(
            approval.assigned_to_user_id,
            {"approval_id": str(approval.id), "type": "email", "subject": subject},
        )

        return {"approval_id": str(approval.id), "status": "pending", "type": "email"}
    finally:
        await session.close()


async def draft_sms(
    team_id: UUID,
    user_id: UUID,
    run_id: UUID,
    *,
    to_contact_id: UUID,
    body: str,
    deal_id: UUID | None = None,
    reasoning: str | None = None,
    compliance_result: dict[str, Any] | None = None,
    assigned_to_user_id: UUID | None = None,
) -> dict[str, Any]:
    """Draft an SMS and create an AgentApproval for rep review."""
    session = await _get_session(team_id)
    try:
        approval = AgentApproval(
            team_id=team_id,
            run_id=run_id,
            type=ApprovalType.sms,
            draft_content={
                "to_contact_id": str(to_contact_id),
                "body": body,
                "deal_id": str(deal_id) if deal_id else None,
            },
            reasoning=reasoning,
            compliance_result=compliance_result,
            assigned_to_user_id=assigned_to_user_id or user_id,
            status=ApprovalStatus.pending,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        session.add(approval)
        await session.commit()

        await ws_manager.publish_approval_created(
            approval.assigned_to_user_id,
            {"approval_id": str(approval.id), "type": "sms"},
        )

        return {"approval_id": str(approval.id), "status": "pending", "type": "sms"}
    finally:
        await session.close()


async def propose_calendar_event(
    team_id: UUID,
    user_id: UUID,
    run_id: UUID,
    *,
    deal_id: UUID,
    proposed_times: list[str],
    description: str,
    reasoning: str | None = None,
    assigned_to_user_id: UUID | None = None,
) -> dict[str, Any]:
    """Propose a calendar event and create an AgentApproval."""
    session = await _get_session(team_id)
    try:
        approval = AgentApproval(
            team_id=team_id,
            run_id=run_id,
            type=ApprovalType.calendar_event,
            draft_content={
                "deal_id": str(deal_id),
                "proposed_times": proposed_times,
                "description": description,
            },
            reasoning=reasoning,
            assigned_to_user_id=assigned_to_user_id or user_id,
            status=ApprovalStatus.pending,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        session.add(approval)
        await session.commit()

        await ws_manager.publish_approval_created(
            approval.assigned_to_user_id,
            {"approval_id": str(approval.id), "type": "calendar_event"},
        )

        return {"approval_id": str(approval.id), "status": "pending", "type": "calendar_event"}
    finally:
        await session.close()


# ── Post-approval execution (called by graph, NEVER by LLM) ─

async def send_approved_message(
    team_id: UUID, user_id: UUID, approval_id: UUID
) -> dict[str, Any]:
    """Send an approved email/SMS. Verifies approval status + freshness."""
    session = await _get_session(team_id)
    try:
        approval = await session.get(AgentApproval, approval_id)
        if not approval:
            return {"error": "Approval not found"}

        if approval.status not in (ApprovalStatus.approved, ApprovalStatus.edited_and_approved):
            return {"error": f"Approval not approved (status={approval.status.value})"}

        if datetime.utcnow() > approval.expires_at:
            return {"error": "Approval has expired"}

        content = approval.edited_content or approval.draft_content
        email_provider, sms_provider = get_messaging_provider()

        contact_id = UUID(content.get("to_contact_id", ""))

        # Get contact for sending details
        from app.models.contact import Contact
        contact = await session.get(Contact, contact_id)
        if not contact:
            return {"error": "Contact not found"}

        if approval.type == ApprovalType.email:
            result = await email_provider.send_email(
                to_email=contact.email,
                subject=content.get("subject", ""),
                body_html=content.get("body", ""),
            )
        elif approval.type == ApprovalType.sms:
            if not contact.phone:
                return {"error": "Contact has no phone number"}
            result = await sms_provider.send_sms(
                to_phone=contact.phone,
                body=content.get("body", ""),
            )
        else:
            return {"error": f"Unsupported approval type: {approval.type.value}"}

        # Create activity record
        activity = Activity(
            team_id=team_id,
            type=ActivityType.email if approval.type == ApprovalType.email else ActivityType.sms,
            contact_id=contact_id,
            deal_id=UUID(content["deal_id"]) if content.get("deal_id") else None,
            subject=content.get("subject", ""),
            body=content.get("body", ""),
            occurred_at=datetime.utcnow(),
            ai_generated=True,
        )
        session.add(activity)

        # Audit log
        await write_audit_log(
            session, team_id=team_id,
            action=f"message.sent.{approval.type.value}",
            entity_type="agent_approval", entity_id=approval_id,
            user_id=user_id,
            after_state={"result": result.success, "provider": result.provider, "message_id": result.message_id},
        )
        await session.commit()

        return {"success": result.success, "message_id": result.message_id, "provider": result.provider}
    finally:
        await session.close()
