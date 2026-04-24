"""ProposalAgent — generates a full sales proposal document when a deal reaches Proposal stage.

Model group: Mistral (document generation / structured writing)
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.ai.llm import Message, chat
from app.ai.tools.read_tools import get_deal, get_account, retrieve_memory

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ProposalAgent for Acufy CRM.
Your job is to generate a complete, professional sales proposal document.

The proposal must include:
1. Executive Summary — why this solution for this specific company
2. Problem Statement — the prospect's pain points (from CRM context)
3. Proposed Solution — your product/service tailored to their needs
4. Pricing & Terms — itemised line items, total ACV, payment terms
5. Implementation Timeline — onboarding phases and milestones
6. Why Acufy — 3 differentiators specific to their industry/size
7. Next Steps — clear call to action

Write in a professional but warm tone. Reference the prospect's actual company name,
industry, and any specific concerns mentioned in the deal context.

Respond in JSON:
{
    "title": "Proposal title",
    "executive_summary": "...",
    "problem_statement": "...",
    "proposed_solution": "...",
    "pricing_table": [
        {"item": "...", "qty": 1, "unit_price": 0, "total": 0}
    ],
    "total_acv": 0,
    "payment_terms": "...",
    "implementation_timeline": [
        {"phase": "Phase 1", "duration": "2 weeks", "milestones": ["..."]}
    ],
    "why_us": ["...", "...", "..."],
    "next_steps": "...",
    "valid_until": "30 days from today",
    "summary": "One-sentence summary for the CRM record"
}"""


async def run_proposal(state: dict[str, Any]) -> dict[str, Any]:
    """Generate a full sales proposal for a deal."""
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

    # Enrich with account data if available
    account_data = None
    if deal_data.get("account_id"):
        account_data = await get_account(team_id, UUID(deal_data["account_id"]))

    # Pull relevant memory (previous research, notes)
    memories = await retrieve_memory(
        team_id,
        query=f"{deal_data.get('name', '')} proposal",
        account_id=UUID(deal_data["account_id"]) if deal_data.get("account_id") else None,
    )

    context_parts = [f"Deal: {json.dumps(deal_data, default=str)}"]
    if account_data:
        context_parts.append(f"Account: {json.dumps(account_data, default=str)}")
    if memories:
        context_parts.append(f"Research notes: {json.dumps(memories[:3], default=str)}")

    try:
        response = await chat(
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(
                    role="user",
                    content=(
                        "Generate a complete sales proposal for:\n"
                        + "\n".join(context_parts)
                    ),
                ),
            ],
            model_group="mistral",
            team_id=team_id,
            user_id=user_id,
            run_id=run_id,
            agent_name="proposal",
        )

        result = json.loads(response.content or "{}")

        # Surface the proposal as a proposed action so the agent router
        # creates an approval card (internal doc — no compliance gate needed)
        state["proposed_actions"].append({
            "type": "proposal_document",
            "content": {
                "title": result.get("title", "Sales Proposal"),
                "body": json.dumps(result, indent=2),
                "deal_id": str(did),
                "total_acv": result.get("total_acv", 0),
                "summary": result.get("summary", ""),
            },
            "deal_id": str(did),
            "reasoning": f"Generated proposal for {deal_data.get('name', 'deal')} — {result.get('summary', '')}",
        })

        return {
            "proposal": result,
            "tokens_used": response.tokens_used,
            "cost_usd": response.cost_usd,
        }

    except Exception as e:
        logger.error(f"ProposalAgent failed: {e}")
        return {"error": str(e)}
