"""Researcher Agent — gathers external and CRM data, stores in memory."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_contact, get_account
from app.ai.tools.write_tools import store_memory, update_account

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Research Agent for a CRM system.
Your job is to research companies and contacts to provide sales reps with actionable intelligence.

Given the available information, generate a research brief covering:
1. Company overview and recent news (based on what you know)
2. Industry trends and competitive landscape
3. Key decision-makers and their likely priorities
4. Potential pain points and opportunities
5. Recommended approach for sales engagement

Respond in JSON:
{
    "company_overview": "...",
    "recent_developments": ["..."],
    "industry_insights": ["..."],
    "key_contacts": [{"name": "...", "likely_role": "...", "engagement_tip": "..."}],
    "pain_points": ["..."],
    "opportunities": ["..."],
    "recommended_approach": "...",
    "summary": "..."
}"""


async def run_researcher(state: dict[str, Any]) -> dict[str, Any]:
    """Execute research on a contact or account."""
    context = state.get("context", {})
    team_id = UUID(str(state["team_id"]))
    user_id = UUID(str(state["user_id"]))
    run_id = UUID(str(state["run_id"]))

    contact_id = context.get("contact_id")
    account_id = context.get("account_id")

    data_parts = []

    if contact_id:
        cid = UUID(contact_id) if isinstance(contact_id, str) else contact_id
        contact_data = await get_contact(team_id, cid)
        data_parts.append(f"Contact: {json.dumps(contact_data, default=str)}")
        if contact_data.get("account_id"):
            account_id = contact_data["account_id"]

    if account_id:
        aid = UUID(account_id) if isinstance(account_id, str) else account_id
        account_data = await get_account(team_id, aid)
        data_parts.append(f"Account: {json.dumps(account_data, default=str)}")

    if not data_parts:
        return {"error": "No contact_id or account_id provided"}

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(role="user", content=f"Research this entity:\n{chr(10).join(data_parts)}"),
            ],
            model_group="llama",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="researcher",
        )

        result = json.loads(response.content or "{}")

        # Store findings in memory
        await store_memory(
            team_id=team_id,
            content=json.dumps(result, default=str),
            source="research",
            contact_id=UUID(contact_id) if contact_id else None,
            account_id=UUID(account_id) if account_id else None,
            metadata={"agent": "researcher", "run_id": str(run_id)},
        )

        return {"research": result, "tokens_used": response.tokens_used, "cost_usd": response.cost_usd}

    except Exception as e:
        logger.error(f"Researcher failed: {e}")
        return {"error": str(e)}
