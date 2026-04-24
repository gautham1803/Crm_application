"""arq worker — background task processing via Redis."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


async def run_agent_task(ctx: dict[str, Any], run_id: str, goal: str, context: dict[str, Any]) -> dict[str, Any]:
    """Execute an agent run in the background."""
    logger.info(f"Starting agent run {run_id}: {goal}")

    try:
        from app.ai.graph import get_graph

        graph = get_graph()
        state = {
            "team_id": context.get("team_id", ""),
            "user_id": context.get("user_id", ""),
            "run_id": run_id,
            "goal": goal,
            "context": context,
            "scratchpad": [],
            "proposed_actions": [],
            "compliance_results": [],
            "pending_approvals": [],
            "status": "running",
            "error": None,
            "current_agent": None,
            "agent_results": {},
        }

        config = {"configurable": {"thread_id": run_id}}
        result = await graph.ainvoke(state, config)

        logger.info(f"Agent run {run_id} completed: {result.get('status', 'unknown')}")
        return result

    except Exception as e:
        logger.error(f"Agent run {run_id} failed: {e}")
        return {"error": str(e), "status": "failed"}


async def process_event(ctx: dict[str, Any], event_type: str, payload: dict[str, Any]) -> None:
    """Process events from Redis Streams."""
    logger.info(f"Processing event: {event_type}")

    if event_type in ("lead.created", "contact.created"):
        contact_id = payload.get("contact_id")
        if contact_id:
            logger.info(f"Auto-qualifying lead: {contact_id}")
            # Could trigger auto-qualification here

    elif event_type == "deal.stage_changed":
        deal_id = payload.get("deal_id")
        logger.info(f"Deal stage changed: {deal_id}")

    elif event_type == "task.overdue":
        logger.info(f"Task overdue notification: {payload}")


async def startup(ctx: dict[str, Any]) -> None:
    """Worker startup — initialize connections."""
    logger.info("arq worker starting up")


async def shutdown(ctx: dict[str, Any]) -> None:
    """Worker shutdown — cleanup."""
    logger.info("arq worker shutting down")


class WorkerSettings:
    """arq worker settings."""

    functions = [run_agent_task, process_event]
    on_startup = startup
    on_shutdown = shutdown

    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    max_jobs = 10
    job_timeout = 300  # 5 minutes
    allow_abort_jobs = True
