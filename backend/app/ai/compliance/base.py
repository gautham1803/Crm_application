"""Compliance base protocols and data classes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, runtime_checkable
from uuid import UUID


@dataclass
class ProposedAction:
    """An action that an agent wants to take."""

    type: Literal["email", "sms", "calendar_invite", "document"]
    content: dict[str, Any]  # subject, body, recipient, etc.
    deal_id: UUID | None = None
    contact_id: UUID | None = None


@dataclass
class ComplianceContext:
    """Context provided to compliance rules for checking."""

    team_id: UUID
    team: Any  # Full Team object
    contact: Any | None = None
    consent_records: list[Any] = field(default_factory=list)
    crm_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleResult:
    """Result of a single compliance rule check."""

    passed: bool
    rule_id: str
    rule_version: str
    violations: list[str] = field(default_factory=list)
    severity: Literal["block", "warn"] = "block"
    feedback: str = ""  # Shown to rep if blocked


@runtime_checkable
class ComplianceRule(Protocol):
    """Protocol for a single compliance rule."""

    id: str
    version: str
    description: str

    async def check(
        self,
        action: ProposedAction,
        context: ComplianceContext,
    ) -> RuleResult:
        ...


@runtime_checkable
class RulePack(Protocol):
    """Protocol for a collection of compliance rules."""

    id: str
    version: str
    rules: list[ComplianceRule]
    applies_to: Literal["all"] | list[str]
