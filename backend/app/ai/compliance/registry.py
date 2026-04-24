"""Compliance rule pack registry."""

from __future__ import annotations

import logging
from typing import Any

from app.ai.compliance.base import ComplianceRule, RulePack

logger = logging.getLogger(__name__)


class RulePackRegistry:
    """Registry for compliance rule packs."""

    def __init__(self) -> None:
        self._packs: dict[str, RulePack] = {}

    def register(self, pack: RulePack) -> None:
        """Register a rule pack."""
        self._packs[pack.id] = pack
        logger.info(f"Registered compliance pack: {pack.id} v{pack.version} ({len(pack.rules)} rules)")

    def get_pack(self, pack_id: str) -> RulePack | None:
        """Get a specific rule pack by ID."""
        return self._packs.get(pack_id)

    def get_active_packs(self, team: Any) -> list[RulePack]:
        """Get all active rule packs for a team."""
        active_ids = getattr(team, "active_rule_packs", ["universal"])
        packs = []
        for pack_id in active_ids:
            pack = self._packs.get(pack_id)
            if pack:
                packs.append(pack)
            else:
                logger.warning(f"Rule pack '{pack_id}' not found in registry")
        return packs

    def get_all_rules(self, team: Any) -> list[ComplianceRule]:
        """Get all rules from all active packs for a team."""
        rules: list[ComplianceRule] = []
        for pack in self.get_active_packs(team):
            rules.extend(pack.rules)
        return rules

    def load_from_config(self, pack_ids: list[str]) -> None:
        """Load rule packs by ID. Currently only 'universal' is implemented."""
        for pack_id in pack_ids:
            if pack_id == "universal":
                from app.ai.compliance.universal import UniversalRulePack
                self.register(UniversalRulePack())
            else:
                logger.warning(f"Unknown rule pack: {pack_id}")


# Singleton
registry = RulePackRegistry()
