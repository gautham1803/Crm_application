"""OpportunityWatchAgent — monitors buying signals and surfaces timely outreach opportunities.

Model group: Mistral (creative pattern-spotting / signal interpretation)
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_account, get_contact
from app.ai.tools.write_tools import create_task

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are OpportunityWatchAgent for Acufy CRM.
Your job is to analyze account and contact data to identify buying signals and
recommend the perfect moment for the sales rep to reach out.

Look for signals like:
- Recent funding rounds or financial events
- New executive hires (CTO, VP Sales, Head of IT)
- Company expansion (new markets, offices, headcount growth)
- Technology stack changes or platform migrations
- Industry events and regulatory changes
- Contract renewal windows
- Competitor displacement opportunities

Respond in JSON:
{
    "signals_found": [
        {
            "signal": "description of the signal",
            "strength": "strong|medium|weak",
            "source": "what data point revealed this"
        }
    ],
    "opportunity_score": 0-100,
    "recommended_timing": "immediate|this_week|this_month|not_now",
    "outreach_angle": "the specific angle to use when reaching out",
    "alert_message": "one-line alert for the rep, e.g. 🔔 Atlas Financial expanding — perfect time to reach out",
    "talking_points": ["...", "..."],
    "risk_factors": ["..."],
    "summary": "2-3 sentence summary of why now is/isn't a good time to reach out"
}"""


async def run_opportunity_watch(state: dict[str, Any]) -> dict[str, Any]:
    """Analyze account/contact signals and surface outreach opportunities."""
    context = state.get("context", {})
    team_id = UUID(str(state["team_id"]))
    user_id = UUID(str(state["user_id"]))
    run_id = UUID(str(state["run_id"]))

    account_id = context.get("account_id")
    contact_id = context.get("contact_id")

    if not account_id and not contact_id:
        return {"error": "No account_id or contact_id provided"}

    data_parts: list[str] = []

    if contact_id:
        cid = UUID(contact_id) if isinstance(contact_id, str) else contact_id
        contact_data = await get_contact(team_id, cid)
        data_parts.append(f"Contact: {json.dumps(contact_data, default=str)}")
        if not account_id and contact_data.get("account_id"):
            account_id = contact_data["account_id"]

    if account_id:
        aid = UUID(account_id) if isinstance(account_id, str) else account_id
        account_data = await get_account(team_id, aid)
        data_parts.append(f"Account: {json.dumps(account_data, default=str)}")

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(
                    role="user",
                    content=(
                        f"Analyze for buying signals and outreach timing:\n"
                        f"{chr(10).join(data_parts)}"
                    ),
                ),
            ],
            model_group="mistral",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="opportunity_watch",
        )

        result = json.loads(response.content or "{}")

        # Create a task for the rep if opportunity score is high
        score = result.get("opportunity_score", 0)
        timing = result.get("recommended_timing", "not_now")
        if score >= 60 and timing in ("immediate", "this_week"):
            entity_id = UUID(account_id) if account_id else UUID(contact_id)  # type: ignore[arg-type]
            await create_task(
                team_id,
                user_id,
                title=f"Opportunity signal detected — {result.get('alert_message', 'Reach out now')}",
                assigned_to=user_id,
                contact_id=UUID(contact_id) if contact_id else None,
                description=(
                    f"Score: {score}/100 | Timing: {timing}\n"
                    f"{result.get('summary', '')}\n\n"
                    f"Outreach angle: {result.get('outreach_angle', '')}"
                ),
            )

        return {
            "opportunity_watch": result,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
        }

    except Exception as e:
        logger.error(f"OpportunityWatchAgent failed: {e}")
        return {"error": str(e)}
