"""MemoryChunk — vector storage for agent memory (pgvector)."""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseTenantModel

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback if pgvector not installed yet
    Vector = None  # type: ignore[assignment, misc]


class MemorySource(str, enum.Enum):
    conversation = "conversation"
    research = "research"
    activity = "activity"
    document = "document"


class MemoryChunk(BaseTenantModel):
    """Vector-indexed memory chunk for semantic search."""

    __tablename__ = "memory_chunks"

    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True, index=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536) if Vector else None,  # type: ignore[arg-type]
        nullable=True,
    )
    source: Mapped[MemorySource] = mapped_column(
        Enum(MemorySource, name="memory_source", create_constraint=True),
        nullable=False,
    )
    metadata_: Mapped[dict | None] = mapped_column(  # avoid clash with SQLAlchemy metadata
        "metadata", JSONB, nullable=True
    )
