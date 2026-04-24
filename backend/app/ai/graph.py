"""LangGraph supervisor graph — dual-model routing with PostgreSQL checkpointing.

Agent model groups
──────────────────
Llama (Groq):   lead_qualifier · researcher · deal_orchestrator · compliance
Mistral:        nurturer · scheduler · opportunity_watch · proposal
Fallback:       gemini (automatic on primary failure)
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from app.ai.state import AgentState
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Goal → agent pipeline mapping ───────────────────────────
GOAL_ROUTING: dict[str, str] = {
    "qualify_lead": "lead_qualifier",
    "nurture_deal": "deal_orchestrator",
    "research_account": "researcher",
    "schedule_meeting": "scheduler",
    "watch_opportunity": "opportunity_watch",
    "generate_proposal": "proposal",
}


def _get_checkpointer():  # type: ignore[no-untyped-def]
    """Create PostgresSaver checkpointer; fall back to MemorySaver if unavailable."""
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool

        db_url = settings.database_url.replace("+psycopg", "")
        pool = ConnectionPool(conninfo=db_url, max_size=5)
        checkpointer = PostgresSaver(pool)
        checkpointer.setup()
        return checkpointer
    except Exception as e:
        logger.warning(f"Could not setup PostgresSaver: {e}. Using MemorySaver fallback.")
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()


# ── Supervisor ───────────────────────────────────────────────

async def supervisor_node(state: dict[str, Any]) -> dict[str, Any]:
    """Route to the appropriate agent based on goal."""
    goal = state.get("goal", "")
    first_agent = GOAL_ROUTING.get(goal, "researcher")
    state["current_agent"] = first_agent
    state["scratchpad"].append({"step": "supervisor", "routed_to": first_agent, "goal": goal})
    return state


# ── Llama group nodes (reasoning / analysis) ────────────────

async def lead_qualifier_node(state: dict[str, Any]) -> dict[str, Any]:
    """Llama — BANT scoring."""
    from app.ai.agents.lead_qualifier import run_lead_qualifier
    result = await run_lead_qualifier(state)
    state["agent_results"]["lead_qualifier"] = result
    state["scratchpad"].append({"step": "lead_qualifier", "result": result})
    return state


async def researcher_node(state: dict[str, Any]) -> dict[str, Any]:
    """Llama — account/contact research."""
    from app.ai.agents.researcher import run_researcher
    result = await run_researcher(state)
    state["agent_results"]["researcher"] = result
    state["scratchpad"].append({"step": "researcher", "result": result})
    return state


async def deal_orchestrator_node(state: dict[str, Any]) -> dict[str, Any]:
    """Llama — deal health analysis and next steps."""
    from app.ai.agents.deal_orchestrator import run_deal_orchestrator
    result = await run_deal_orchestrator(state)
    state["agent_results"]["deal_orchestrator"] = result
    state["scratchpad"].append({"step": "deal_orchestrator", "result": result})
    return state


# ── Mistral group nodes (generation / creative) ─────────────

async def nurturer_node(state: dict[str, Any]) -> dict[str, Any]:
    """Mistral — personalized email/SMS drafting."""
    from app.ai.agents.nurturer import run_nurturer
    result = await run_nurturer(state)
    state["agent_results"]["nurturer"] = result
    state["scratchpad"].append({"step": "nurturer", "result": result})
    return state


async def scheduler_node(state: dict[str, Any]) -> dict[str, Any]:
    """Mistral — meeting scheduling and calendar coordination."""
    from app.ai.agents.scheduler import run_scheduler
    result = await run_scheduler(state)
    state["agent_results"]["scheduler"] = result
    state["scratchpad"].append({"step": "scheduler", "result": result})
    return state


async def opportunity_watch_node(state: dict[str, Any]) -> dict[str, Any]:
    """Mistral — buying signal detection and outreach timing."""
    from app.ai.agents.opportunity_watch import run_opportunity_watch
    result = await run_opportunity_watch(state)
    state["agent_results"]["opportunity_watch"] = result
    state["scratchpad"].append({"step": "opportunity_watch", "result": result})
    return state


async def proposal_node(state: dict[str, Any]) -> dict[str, Any]:
    """Mistral — full proposal document generation."""
    from app.ai.agents.proposal import run_proposal
    result = await run_proposal(state)
    state["agent_results"]["proposal"] = result
    state["scratchpad"].append({"step": "proposal", "result": result})
    return state


# ── Compliance node (Llama) ──────────────────────────────────

async def compliance_node(state: dict[str, Any]) -> dict[str, Any]:
    """Llama — runs BEFORE any draft reaches the approval queue."""
    from app.ai.compliance.registry import registry
    from app.ai.compliance.base import ComplianceContext, ProposedAction

    proposed = state.get("proposed_actions", [])
    if not proposed:
        return state

    team_id = UUID(str(state["team_id"]))

    from app.core.database import async_session_factory
    from app.models.team import Team

    session = async_session_factory()
    try:
        team = await session.get(Team, team_id)
        if not team:
            state["error"] = "Team not found for compliance check"
            state["status"] = "failed"
            return state

        rules = registry.get_all_rules(team)

        for action_data in proposed:
            # Proposal documents skip communication compliance — internal only
            if action_data.get("type") == "proposal_document":
                state["compliance_results"].append({
                    "action": action_data,
                    "results": [{"rule_id": "proposal_exempt", "passed": True, "severity": "none", "violations": [], "feedback": "Internal document — no outbound compliance required"}],
                    "blocked": False,
                })
                continue

            context = ComplianceContext(
                team_id=team_id,
                team=team,
                crm_data=state.get("context", {}),
            )
            action = ProposedAction(
                type=action_data.get("type", "email"),
                content=action_data.get("content", {}),
                contact_id=UUID(action_data["contact_id"]) if action_data.get("contact_id") else None,
                deal_id=UUID(action_data["deal_id"]) if action_data.get("deal_id") else None,
            )

            results = []
            blocked = False
            for rule in rules:
                result = await rule.check(action, context)
                results.append({
                    "rule_id": result.rule_id,
                    "passed": result.passed,
                    "severity": result.severity,
                    "violations": result.violations,
                    "feedback": result.feedback,
                })
                if not result.passed and result.severity == "block":
                    blocked = True

            state["compliance_results"].append({
                "action": action_data,
                "results": results,
                "blocked": blocked,
            })

            if blocked:
                state["status"] = "failed"
                state["error"] = "Compliance check failed — action blocked"
                return state
    finally:
        await session.close()

    return state


# ── Edge routing ─────────────────────────────────────────────

def _route_after_supervisor(state: dict[str, Any]) -> str:
    goal = state.get("goal", "")
    return GOAL_ROUTING.get(goal, "researcher")


def _route_after_agent(state: dict[str, Any]) -> str:
    if state.get("proposed_actions"):
        return "compliance"
    if state.get("status") == "failed":
        return "end"
    return "end"


# ── Graph builder ────────────────────────────────────────────

_ALL_AGENT_NODES = [
    "lead_qualifier",
    "researcher",
    "deal_orchestrator",
    "nurturer",
    "scheduler",
    "opportunity_watch",
    "proposal",
]


def build_graph():  # type: ignore[no-untyped-def]
    """Build and compile the LangGraph supervisor graph."""
    from langgraph.graph import StateGraph, END

    builder = StateGraph(dict)

    # Nodes
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("lead_qualifier", lead_qualifier_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("deal_orchestrator", deal_orchestrator_node)
    builder.add_node("nurturer", nurturer_node)
    builder.add_node("scheduler", scheduler_node)
    builder.add_node("opportunity_watch", opportunity_watch_node)
    builder.add_node("proposal", proposal_node)
    builder.add_node("compliance", compliance_node)

    # Entry
    builder.set_entry_point("supervisor")

    # Supervisor → agent
    builder.add_conditional_edges(
        "supervisor",
        _route_after_supervisor,
        {name: name for name in _ALL_AGENT_NODES},
    )

    # Agent → compliance or end
    for node_name in _ALL_AGENT_NODES:
        builder.add_conditional_edges(
            node_name,
            _route_after_agent,
            {"compliance": "compliance", "end": END},
        )

    # Compliance → end (HITL approval handled externally via /api/v1/ai/approvals)
    builder.add_edge("compliance", END)

    checkpointer = _get_checkpointer()
    return builder.compile(checkpointer=checkpointer)


# ── Lazy singleton ────────────────────────────────────────────
_graph = None


def get_graph():  # type: ignore[no-untyped-def]
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
