"""Lead Qualifier Agent — BANT scoring, research, task creation."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_contact, get_account
from app.ai.tools.write_tools import update_contact, create_task

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Lead Qualification Agent for a CRM system.
Your job is to assess leads using the BANT framework:
- Budget: Does the prospect have budget for the solution?
- Authority: Is the contact a decision-maker?
- Need: Does the prospect have a genuine need?
- Timeline: Is there a defined timeline for purchase?

Analyze the available data and provide:
1. A BANT score (0-100)
2. Assessment for each BANT criterion
3. Recommended next action (e.g., schedule demo, send info, disqualify)
4. Key talking points for the sales rep

Respond in JSON format:
{
    "bant_score": 75,
    "budget": {"score": 80, "notes": "..."},
    "authority": {"score": 70, "notes": "..."},
    "need": {"score": 90, "notes": "..."},
    "timeline": {"score": 60, "notes": "..."},
    "recommended_action": "schedule_demo",
    "talking_points": ["...", "..."],
    "summary": "..."
}"""


async def run_lead_qualifier(state: dict[str, Any]) -> dict[str, Any]:
    """Execute lead qualification."""
    context = state.get("context", {})
    contact_id = context.get("contact_id")
    team_id = UUID(str(state["team_id"]))
    user_id = UUID(str(state["user_id"]))
    run_id = UUID(str(state["run_id"]))

    if not contact_id:
        return {"error": "No contact_id in context"}

    contact_id = UUID(contact_id) if isinstance(contact_id, str) else contact_id

    # Gather data
    contact_data = await get_contact(team_id, contact_id)
    account_data = None
    if contact_data.get("account_id"):
        account_data = await get_account(team_id, UUID(contact_data["account_id"]))

    data_summary = f"Contact: {json.dumps(contact_data, default=str)}"
    if account_data:
        data_summary += f"\nAccount: {json.dumps(account_data, default=str)}"

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(role="user", content=f"Please qualify this lead:\n{data_summary}"),
            ],
            model_group="llama",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="lead_qualifier",
        )

        result = json.loads(response.content or "{}")

        # Update contact with qualification data
        await update_contact(
            team_id, user_id, contact_id,
            {"custom_fields": {
                "bant_score": result.get("bant_score", 0),
                "qualification_summary": result.get("summary", ""),
                "qualified_at": "auto",
            }},
        )

        # Create task for rep if high-score lead
        if result.get("bant_score", 0) >= 60:
            await create_task(
                team_id, user_id,
                title=f"Follow up with qualified lead: {contact_data.get('first_name', '')} {contact_data.get('last_name', '')}",
                assigned_to=user_id,
                contact_id=contact_id,
                description=f"BANT Score: {result.get('bant_score')}. {result.get('summary', '')}",
            )

        return {"qualification": result, "tokens_used": response.tokens_used, "cost_usd": response.cost_usd}

    except Exception as e:
        logger.error(f"Lead qualifier failed: {e}")
        return {"error": str(e)}
