"""LLM wrapper — dual-model routing via LiteLLM with budget enforcement.

Agent model groups:
  llama  → groq/llama-3.3-70b-versatile  (LeadQualifier, Research, DealOrchestrator, Compliance)
  mistral → mistral/mistral-large-latest  (Nurturer, Scheduler, OpportunityWatch, Proposal)
  fallback → gemini/gemini-1.5-flash      (both groups on failure)
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

ModelGroup = Literal["llama", "mistral"]


@dataclass
class Message:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]


@dataclass
class Response:
    content: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""
    tokens_used: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0


class BudgetExceededError(Exception):
    """Raised when team or user daily budget is exceeded."""
    pass


def _set_api_keys() -> None:
    """Inject all provider API keys into the environment for LiteLLM."""
    os.environ["GROQ_API_KEY"] = settings.groq_api_key.get_secret_value()
    os.environ["GOOGLE_API_KEY"] = settings.google_api_key.get_secret_value()
    mistral_key = settings.mistral_api_key.get_secret_value()
    if mistral_key and mistral_key != "your_mistral_api_key_here":
        os.environ["MISTRAL_API_KEY"] = mistral_key


def _primary_model(group: ModelGroup) -> str:
    """Return the primary model name for a given agent group."""
    if group == "mistral":
        return settings.llm_mistral_model
    return settings.llm_llama_model  # default: llama


async def _check_budget(redis_client: aioredis.Redis, team_id: UUID, user_id: UUID) -> None:
    """Check if team/user daily budget is exceeded."""
    team_key = f"budget:team:{team_id}:{time.strftime('%Y-%m-%d')}"
    user_key = f"budget:user:{user_id}:{time.strftime('%Y-%m-%d')}"

    team_spent_raw = await redis_client.get(team_key)
    team_spent = float(team_spent_raw) if team_spent_raw else 0.0
    if team_spent >= settings.llm_budget_per_team_daily_usd:
        raise BudgetExceededError(
            f"Team daily budget exceeded: ${team_spent:.4f} / ${settings.llm_budget_per_team_daily_usd}"
        )

    user_spent_raw = await redis_client.get(user_key)
    user_spent = float(user_spent_raw) if user_spent_raw else 0.0
    if user_spent >= settings.llm_budget_per_user_daily_usd:
        raise BudgetExceededError(
            f"User daily budget exceeded: ${user_spent:.4f} / ${settings.llm_budget_per_user_daily_usd}"
        )


async def _record_cost(
    redis_client: aioredis.Redis, team_id: UUID, user_id: UUID, cost: float
) -> None:
    """Record LLM cost in Redis with 24h TTL."""
    today = time.strftime("%Y-%m-%d")
    team_key = f"budget:team:{team_id}:{today}"
    user_key = f"budget:user:{user_id}:{today}"

    pipe = redis_client.pipeline()
    pipe.incrbyfloat(team_key, cost)
    pipe.expire(team_key, 86400)
    pipe.incrbyfloat(user_key, cost)
    pipe.expire(user_key, 86400)
    await pipe.execute()


async def _call_litellm(
    model: str,
    litellm_messages: list[dict],
    litellm_tools: list[dict] | None,
) -> Any:
    """Single LiteLLM call — raises on failure."""
    import litellm
    return await litellm.acompletion(
        model=model,
        messages=litellm_messages,
        tools=litellm_tools,
        tool_choice="auto" if litellm_tools else None,
    )


async def chat(
    messages: list[Message],
    *,
    model_group: ModelGroup = "llama",
    model: str | None = None,
    tools: list[Tool] | None = None,
    team_id: UUID,
    user_id: UUID,
    run_id: UUID,
    agent_name: str,
) -> Response:
    """Main LLM call with dual-model routing, budget enforcement, and Gemini fallback.

    Resolution order:
      1. `model` if explicitly passed (override)
      2. `model_group` → llama or mistral primary model
      3. Gemini fallback on any error
    """
    _set_api_keys()

    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)

    try:
        await _check_budget(redis_client, team_id, user_id)
    except BudgetExceededError:
        await redis_client.aclose()
        raise

    selected_model = model or _primary_model(model_group)

    litellm_messages = [
        {
            "role": m.role,
            "content": m.content,
            **({"tool_call_id": m.tool_call_id} if m.tool_call_id else {}),
        }
        for m in messages
    ]

    litellm_tools = None
    if tools:
        litellm_tools = [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]

    start = time.time()
    try:
        response = await _call_litellm(selected_model, litellm_messages, litellm_tools)
    except Exception as primary_err:
        logger.warning(
            f"[{agent_name}] {model_group.upper()} model ({selected_model}) failed: {primary_err}. "
            f"Falling back to Gemini."
        )
        try:
            response = await _call_litellm(
                settings.llm_fallback_model, litellm_messages, litellm_tools
            )
            selected_model = settings.llm_fallback_model
        except Exception as fallback_err:
            await redis_client.aclose()
            raise RuntimeError(
                f"All LLM providers failed for {agent_name}: {fallback_err}"
            ) from fallback_err

    latency_ms = (time.time() - start) * 1000

    choice = response.choices[0]
    content = choice.message.content
    tool_calls_raw = choice.message.tool_calls or []
    tool_calls = [
        {
            "id": tc.id,
            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
        }
        for tc in tool_calls_raw
    ]

    usage = response.usage
    tokens = usage.total_tokens if usage else 0
    cost = (
        float(response._hidden_params.get("response_cost", 0))
        if hasattr(response, "_hidden_params")
        else 0.0
    )

    if cost > 0:
        await _record_cost(redis_client, team_id, user_id, cost)

    # Langfuse trace (best-effort)
    try:
        from langfuse import Langfuse

        lf = Langfuse(
            public_key=settings.langfuse_public_key.get_secret_value(),
            secret_key=settings.langfuse_secret_key.get_secret_value(),
            host=settings.langfuse_host,
        )
        lf.generation(
            name=f"{agent_name}/chat",
            model=selected_model,
            input=litellm_messages,
            output=content or str(tool_calls),
            metadata={
                "team_id": str(team_id),
                "user_id": str(user_id),
                "run_id": str(run_id),
                "agent_name": agent_name,
                "model_group": model_group,
                "cost_usd": cost,
                "tokens": tokens,
                "latency_ms": latency_ms,
            },
        )
        lf.flush()
    except Exception as trace_err:
        logger.debug(f"Langfuse trace failed: {trace_err}")

    await redis_client.aclose()

    return Response(
        content=content,
        tool_calls=tool_calls,
        model=selected_model,
        tokens_used=tokens,
        cost_usd=cost,
        latency_ms=latency_ms,
    )


async def generate_embedding(text: str) -> list[float]:
    """Generate a vector embedding using Google's embedding model."""
    import litellm

    _set_api_keys()

    response = await litellm.aembedding(
        model="gemini/text-embedding-004",
        input=[text],
    )
    return response.data[0]["embedding"]
