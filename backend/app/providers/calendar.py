"""Calendar provider — Google Calendar stub."""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CalendarEvent:
    event_id: str
    summary: str
    start_time: str
    end_time: str
    attendees: list[str]


class CalendarProvider:
    """Google Calendar integration (stub for now)."""

    async def create_event(
        self,
        summary: str,
        start_time: str,
        end_time: str,
        attendees: list[str],
        description: str | None = None,
    ) -> CalendarEvent | None:
        """Create a calendar event. Stub implementation."""
        logger.info(f"[STUB] Calendar event created: {summary} ({start_time} - {end_time})")
        return CalendarEvent(
            event_id="stub-event-001",
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            attendees=attendees,
        )

    async def get_availability(
        self,
        user_email: str,
        start_date: str,
        end_date: str,
    ) -> list[dict[str, str]]:
        """Get available time slots. Stub returns mock availability."""
        logger.info(f"[STUB] Checking availability for {user_email}")
        return [
            {"start": f"{start_date}T09:00:00", "end": f"{start_date}T10:00:00"},
            {"start": f"{start_date}T14:00:00", "end": f"{start_date}T15:00:00"},
        ]
