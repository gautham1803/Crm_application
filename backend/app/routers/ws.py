"""WebSocket endpoint for real-time frontend updates."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/{team_id}")
async def websocket_endpoint(websocket: WebSocket, team_id: UUID, user_id: UUID | None = None) -> None:
    """Accept real-time WebSocket connection from the frontend.
    
    Channels:
        - team_events:{team_id}: All events scoped to the team.
        - approval_created:{user_id}: Events for a specific user.
        - task_overdue:{user_id}: Tasks specifically for the user.
    """
    channels = [f"ws:team_events:{team_id}"]
    if user_id:
        channels.append(f"ws:approval_created:{user_id}")
        channels.append(f"ws:task_overdue:{user_id}")

    # For simplicity in this endpoint, we'll listen to a team-wide channel.
    # In production, ws_manager should handle pub/sub subscription forwarding 
    # to individual websocket connections dynamically based on their requested channel map.
    
    # We will subscribe this socket to just its relevant user channel (approvals) for now
    channel = f"approval_created:{user_id}" if user_id else f"team_events:{team_id}"
    
    await ws_manager.connect(websocket, channel)
    try:
        while True:
            # Keep-alive loop
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, channel)
        logger.info(f"WebSocket disconnected from channel: {channel}")
