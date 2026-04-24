"""WebSocket manager with Redis pub/sub backend."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.events import UUIDEncoder

logger = logging.getLogger(__name__)

# Channel patterns
CHANNELS = {
    "agent_run_update": "ws:agent_run_update:{run_id}",
    "approval_created": "ws:approval_created:{user_id}",
    "deal_stage_changed": "ws:deal_stage_changed:{deal_id}",
    "task_overdue": "ws:task_overdue:{user_id}",
}


class WebSocketManager:
    """WebSocket manager backed by Redis pub/sub for multi-replica support."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None

    async def connect_redis(self) -> None:
        self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    async def disconnect_redis(self) -> None:
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.aclose()

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        """Accept WebSocket and register on channel."""
        await websocket.accept()
        if channel not in self._connections:
            self._connections[channel] = []
        self._connections[channel].append(websocket)
        logger.info(f"WebSocket connected to channel: {channel}")

    async def disconnect(self, websocket: WebSocket, channel: str) -> None:
        """Remove WebSocket from channel."""
        if channel in self._connections:
            self._connections[channel] = [
                ws for ws in self._connections[channel] if ws != websocket
            ]
            if not self._connections[channel]:
                del self._connections[channel]

    async def broadcast(self, channel: str, data: dict[str, Any]) -> None:
        """Send message to all local connections on a channel, and publish to Redis."""
        message = json.dumps(data, cls=UUIDEncoder)

        # Publish to Redis for cross-replica delivery
        if self._redis:
            await self._redis.publish(f"ws:{channel}", message)

        # Send to local connections
        await self._send_local(channel, message)

    async def _send_local(self, channel: str, message: str) -> None:
        """Send to locally connected WebSockets."""
        if channel not in self._connections:
            return
        dead: list[WebSocket] = []
        for ws in self._connections[channel]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[channel].remove(ws)

    async def publish_approval_created(
        self, user_id: UUID, approval_data: dict[str, Any]
    ) -> None:
        """Convenience method: notify a user about a new approval."""
        channel = f"approval_created:{user_id}"
        await self.broadcast(channel, {
            "type": "approval_created",
            "data": approval_data,
        })

    async def publish_deal_stage_changed(
        self, deal_id: UUID, stage_data: dict[str, Any]
    ) -> None:
        """Convenience method: notify about deal stage change."""
        channel = f"deal_stage_changed:{deal_id}"
        await self.broadcast(channel, {
            "type": "deal_stage_changed",
            "data": stage_data,
        })

    async def publish_agent_run_update(
        self, run_id: UUID, update_data: dict[str, Any]
    ) -> None:
        """Convenience method: notify about agent run update."""
        channel = f"agent_run_update:{run_id}"
        await self.broadcast(channel, {
            "type": "agent_run_update",
            "data": update_data,
        })


# Singleton
ws_manager = WebSocketManager()
