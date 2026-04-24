"""Deal Orchestrator Agent — monitors deals and proposes next steps."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_deal

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Deal Orchestrator Agent for a CRM system.
Your job is to analyze deal progress and suggest next steps.

Analyze:
- Current deal stage and how long it's been there
- Stakeholder engagement
- Activity history
- Deal amount and probability
- Expected close date vs current date

Provide:
1. Deal health assessment (healthy/stalling/at_risk/critical)
2. Recommended next steps (specific, actionable)
3. Whether to trigger nurture email or schedule meeting
4. Risk factors

Respond in JSON:
{
    "health": "healthy|stalling|at_risk|critical",
    "score": 75,
    "next_steps": ["...", "..."],
    "trigger_nurture": true/false,
    "trigger_meeting": true/false,
    "risk_factors": ["..."],
    "summary": "..."
}"""


async def run_deal_orchestrator(state: dict[str, Any]) -> dict[str, Any]:
    """Analyze deal and propose next steps."""
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
                Message(role="user", content=f"Analyze this deal:\n{json.dumps(deal_data, default=str)}"),
            ],
            model_group="llama",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="deal_orchestrator",
        )

        result = json.loads(response.content or "{}")
        return {
            "analysis": result,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
        }

    except Exception as e:
        logger.error(f"Deal orchestrator failed: {e}")
        return {"error": str(e)}
