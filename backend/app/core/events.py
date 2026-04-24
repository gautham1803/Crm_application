"""Redis Streams event bus for internal events."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

import redis.asyncio as aioredis

from app.core.config import settings

# ── Event Types ─────────────────────────────────────────────
EVENT_TYPES = [
    "lead.created",
    "lead.stage_changed",
    "contact.created",
    "account.created",
    "deal.created",
    "deal.stage_changed",
    "deal.won",
    "deal.lost",
    "message.received",
    "message.consent_revoked",
    "document.uploaded",
    "task.overdue",
]

STREAM_KEY = "acufy:events"


class UUIDEncoder(json.JSONEncoder):
    """JSON encoder that handles UUID and datetime objects."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class EventBus:
    """Redis Streams-based event bus."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def connect(self) -> None:
        self._redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )

    async def disconnect(self) -> None:
        if self._redis:
            await self._redis.aclose()

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            raise RuntimeError("EventBus not connected")
        return self._redis

    async def publish(
        self,
        event_type: str,
        payload: dict[str, Any],
        *,
        team_id: UUID | None = None,
    ) -> str:
        """Publish an event to the Redis stream."""
        message = {
            "type": event_type,
            "payload": json.dumps(payload, cls=UUIDEncoder),
            "team_id": str(team_id) if team_id else "",
            "timestamp": datetime.utcnow().isoformat(),
        }
        msg_id: str = await self.redis.xadd(STREAM_KEY, message)  # type: ignore[assignment]
        return msg_id

    async def consume(
        self,
        group: str,
        consumer: str,
        *,
        count: int = 10,
        block: int = 5000,
    ) -> list[dict[str, Any]]:
        """Consume events from the stream as part of a consumer group."""
        # Create group if not exists
        try:
            await self.redis.xgroup_create(STREAM_KEY, group, id="0", mkstream=True)
        except aioredis.ResponseError:
            pass  # Group already exists

        results = await self.redis.xreadgroup(
            groupname=group,
            consumername=consumer,
            streams={STREAM_KEY: ">"},
            count=count,
            block=block,
        )

        events: list[dict[str, Any]] = []
        for _stream, messages in results:
            for msg_id, data in messages:
                event = {
                    "id": msg_id,
                    "type": data.get("type", ""),
                    "payload": json.loads(data.get("payload", "{}")),
                    "team_id": data.get("team_id", ""),
                    "timestamp": data.get("timestamp", ""),
                }
                events.append(event)
                # Acknowledge
                await self.redis.xack(STREAM_KEY, group, msg_id)

        return events


# Singleton
event_bus = EventBus()
