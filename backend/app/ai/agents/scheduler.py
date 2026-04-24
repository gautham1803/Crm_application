"""Scheduler Agent — proposes meeting times."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_deal, get_contact

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Meeting Scheduler Agent for a CRM system.
Your job is to propose meeting times and draft scheduling communications.

Based on the deal context:
1. Suggest 2-3 possible meeting times (business hours, next 2 weeks)
2. Draft a brief, professional meeting invitation email
3. Include meeting purpose aligned with the deal stage

Respond in JSON:
{
    "proposed_times": [
        "2026-04-25T10:00:00",
        "2026-04-25T14:00:00",
        "2026-04-28T11:00:00"
    ],
    "meeting_type": "demo|discovery|proposal_review|negotiation",
    "duration_minutes": 30,
    "subject": "...",
    "description": "...",
    "email_body": "..."
}"""


async def run_scheduler(state: dict[str, Any]) -> dict[str, Any]:
    """Propose meeting times and draft invitation."""
    context = state.get("context", {})
    team_id = UUID(str(state["team_id"]))
    user_id = UUID(str(state["user_id"]))
    run_id = UUID(str(state["run_id"]))

    deal_id = context.get("deal_id")
    if not deal_id:
        return {"error": "No deal_id provided"}

    did = UUID(deal_id) if isinstance(deal_id, str) else deal_id
    deal_data = await get_deal(team_id, did)

    if deal_data.get("error"):
        return deal_data

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(role="user", content=f"Schedule a meeting for this deal:\n{json.dumps(deal_data, default=str)}"),
            ],
            model_group="mistral",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="scheduler",
        )

        result = json.loads(response.content or "{}")

        # Add proposed action for compliance
        if result.get("email_body"):
            contact_id = deal_data.get("contact")
            state["proposed_actions"].append({
                "type": "email",
                "content": {
                    "subject": result.get("subject", "Meeting Request"),
                    "body": result.get("email_body", ""),
                },
                "deal_id": str(did),
                "reasoning": f"Scheduling {result.get('meeting_type', 'meeting')} meeting",
            })

        return {
            "schedule": result,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
        }

    except Exception as e:
        logger.error(f"Scheduler failed: {e}")
        return {"error": str(e)}
