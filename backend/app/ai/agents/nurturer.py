"""Nurturer Agent — drafts personalized outreach emails with compliance."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_contact, get_deal, retrieve_memory

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Sales Nurturer Agent for a CRM system.
Your job is to draft personalized sales emails that are professional,
relevant, and compelling.

Guidelines:
- Use the contact's name and reference their specific situation
- Reference deal context (stage, products, previous interactions)
- Be genuine and helpful, not pushy
- Include a clear call-to-action
- Keep emails concise (under 300 words)
- MUST include an unsubscribe reference (the system will add the actual link)
- The company signature block will be appended automatically

Respond in JSON:
{
    "subject": "...",
    "body": "...",
    "reasoning": "Why I drafted this specific message",
    "tone": "professional|casual|urgent",
    "call_to_action": "..."
}"""


async def run_nurturer(state: dict[str, Any]) -> dict[str, Any]:
    """Draft a personalized outreach email."""
    context = state.get("context", {})
    team_id = UUID(str(state["team_id"]))
    user_id = UUID(str(state["user_id"]))
    run_id = UUID(str(state["run_id"]))

    contact_id = context.get("contact_id")
    deal_id = context.get("deal_id")
    goal_type = context.get("nurture_type", "follow_up")

    if not contact_id:
        return {"error": "No contact_id provided"}

    cid = UUID(contact_id) if isinstance(contact_id, str) else contact_id

    # Gather context
    contact_data = await get_contact(team_id, cid)
    deal_data = None
    if deal_id:
        did = UUID(deal_id) if isinstance(deal_id, str) else deal_id
        deal_data = await get_deal(team_id, did)

    # Retrieve relevant memories
    memories = await retrieve_memory(
        team_id,
        query=f"{contact_data.get('first_name', '')} {contact_data.get('last_name', '')}",
        contact_id=cid,
    )

    context_text = f"Goal: {goal_type}\n"
    context_text += f"Contact: {json.dumps(contact_data, default=str)}\n"
    if deal_data:
        context_text += f"Deal: {json.dumps(deal_data, default=str)}\n"
    if memories:
        context_text += f"Previous knowledge: {json.dumps(memories, default=str)}\n"

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(role="user", content=f"Draft a {goal_type} email:\n{context_text}"),
            ],
            model_group="mistral",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="nurturer",
        )

        result = json.loads(response.content or "{}")

        # Ensure unsubscribe text is in body
        body = result.get("body", "")
        if "unsubscribe" not in body.lower():
            body += "\n\nIf you no longer wish to receive these emails, you can unsubscribe at any time."
            result["body"] = body

        # Add proposed action for compliance check
        state["proposed_actions"].append({
            "type": "email",
            "content": {
                "subject": result.get("subject", ""),
                "body": result.get("body", ""),
                "to_contact_id": str(cid),
                "deal_id": str(deal_id) if deal_id else None,
            },
            "contact_id": str(cid),
            "deal_id": str(deal_id) if deal_id else None,
            "reasoning": result.get("reasoning", ""),
        })

        return {
            "draft": result,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
        }

    except Exception as e:
        logger.error(f"Nurturer failed: {e}")
        return {"error": str(e)}
