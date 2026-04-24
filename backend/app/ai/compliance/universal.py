"""Universal compliance rule pack — 5 rules that apply to all teams."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

from app.ai.compliance.base import (
    ComplianceContext,
    ComplianceRule,
    ProposedAction,
    RuleResult,
    RulePack,
)

logger = logging.getLogger(__name__)

# ── PII patterns ────────────────────────────────────────────
PII_PATTERNS = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
    (r"\b\d{9}\b", "SSN (no dashes)"),
    (r"\b[A-Z]{1,2}\d{6,9}\b", "Passport number"),
    (r"\b\d{8,17}\b(?=.*account)", "Financial account number"),
]


@dataclass
class TCPAConsentRule:
    """Rule 1: TCPA — SMS requires explicit consent."""

    id: str = "tcpa_consent"
    version: str = "1.0"
    description: str = "Verifies contact has active SMS consent before sending SMS"

    async def check(self, action: ProposedAction, context: ComplianceContext) -> RuleResult:
        if action.type != "sms":
            return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)

        # Check consent records
        sms_consents = [
            r for r in context.consent_records
            if r.type.value == "sms"  # type: ignore[union-attr]
        ]
        if not sms_consents:
            return RuleResult(
                passed=False,
                rule_id=self.id,
                rule_version=self.version,
                violations=["No SMS consent record found"],
                severity="block",
                feedback="Contact has not provided SMS consent. Collect consent before sending SMS.",
            )

        # Check latest record is a grant
        latest = sorted(sms_consents, key=lambda r: r.timestamp, reverse=True)[0]
        if latest.action.value != "grant":  # type: ignore[union-attr]
            return RuleResult(
                passed=False,
                rule_id=self.id,
                rule_version=self.version,
                violations=["SMS consent has been revoked"],
                severity="block",
                feedback="Contact has revoked SMS consent. Cannot send SMS.",
            )

        return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)


@dataclass
class CANSPAMRule:
    """Rule 2: CAN-SPAM — email requirements."""

    id: str = "can_spam"
    version: str = "1.0"
    description: str = "Checks email contains unsubscribe link and signature block"

    async def check(self, action: ProposedAction, context: ComplianceContext) -> RuleResult:
        if action.type != "email":
            return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)

        violations: list[str] = []
        body = action.content.get("body", "")
        subject = action.content.get("subject", "")

        # Check unsubscribe link
        unsubscribe_patterns = [
            r"unsubscribe",
            r"opt.?out",
            r"remove.*from.*list",
        ]
        has_unsubscribe = any(
            re.search(pattern, body, re.IGNORECASE) for pattern in unsubscribe_patterns
        )
        if not has_unsubscribe:
            violations.append("Email body missing unsubscribe link/text")

        # Check signature block
        sig_block = getattr(context.team, "company_signature_block", None)
        if sig_block:
            # Check if core parts of signature are present
            sig_parts = sig_block.replace("{unsubscribe_url}", "").strip()
            if sig_parts and sig_parts[:20].lower() not in body.lower():
                violations.append("Email missing company signature block")
        else:
            violations.append("Team has no company signature block configured")

        # LLM check for misleading subject line (simplified — checks basic patterns)
        misleading_patterns = [
            r"^re:\s",  # Fake reply
            r"^fw:\s",  # Fake forward
            r"^fwd:\s",
            r"urgent.*act now",
            r"guaranteed.*winner",
        ]
        for pattern in misleading_patterns:
            if re.search(pattern, subject, re.IGNORECASE):
                violations.append(f"Subject line may be misleading: matches pattern '{pattern}'")
                break

        if violations:
            return RuleResult(
                passed=False,
                rule_id=self.id,
                rule_version=self.version,
                violations=violations,
                severity="block",
                feedback=f"CAN-SPAM violations: {'; '.join(violations)}",
            )

        return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)


@dataclass
class GDPRCCPARule:
    """Rule 3: GDPR/CCPA — data protection checks."""

    id: str = "gdpr_ccpa"
    version: str = "1.0"
    description: str = "Checks for deletion requests and PII exposure"

    async def check(self, action: ProposedAction, context: ComplianceContext) -> RuleResult:
        if action.type not in ("email", "sms"):
            return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)

        violations: list[str] = []
        body = action.content.get("body", "")

        # Check for PII in body
        for pattern, pii_type in PII_PATTERNS:
            if re.search(pattern, body):
                violations.append(f"Body contains potential {pii_type}")

        if violations:
            return RuleResult(
                passed=False,
                rule_id=self.id,
                rule_version=self.version,
                violations=violations,
                severity="block",
                feedback=f"PII detected in message body: {'; '.join(violations)}",
            )

        return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)


@dataclass
class AntiDiscriminationRule:
    """Rule 4: Anti-discrimination — checks for protected class references."""

    id: str = "anti_discrimination"
    version: str = "1.0"
    description: str = "Checks for discriminatory language in communications"

    async def check(self, action: ProposedAction, context: ComplianceContext) -> RuleResult:
        if action.type not in ("email", "sms"):
            return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)

        body = action.content.get("body", "")
        subject = action.content.get("subject", "")
        full_text = f"{subject} {body}"

        # Try LLM check for discrimination
        try:
            from app.ai.llm import chat, Message

            llm_response = await chat(
                messages=[
                    Message(
                        role="system",
                        content=(
                            "You are a compliance checker. Review this sales communication "
                            "for references to protected classes (race, religion, sex, national origin, "
                            "age, disability, sexual orientation, gender identity) that could constitute "
                            "discriminatory communication. Respond with JSON only: "
                            '{"passed": true/false, "violations": ["..."], "feedback": "..."}'
                        ),
                    ),
                    Message(role="user", content=full_text),
                ],
                model_group="llama",
                team_id=context.team_id,
                user_id=context.team_id,
                run_id=context.team_id,
                agent_name="compliance_anti_discrimination",
            )

            if llm_response.content:
                try:
                    result = json.loads(llm_response.content)
                    if not result.get("passed", True):
                        return RuleResult(
                            passed=False,
                            rule_id=self.id,
                            rule_version=self.version,
                            violations=result.get("violations", []),
                            severity="block",
                            feedback=result.get("feedback", "Discriminatory language detected"),
                        )
                except json.JSONDecodeError:
                    logger.warning("Anti-discrimination LLM check returned non-JSON")
        except Exception as e:
            logger.warning(f"Anti-discrimination LLM check failed: {e}")
            # Fall through to pass if LLM is unavailable

        return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)


@dataclass
class HonestyRule:
    """Rule 5: Honesty — checks factual claims against CRM data. Warn severity."""

    id: str = "honesty"
    version: str = "1.0"
    description: str = "Checks factual claims are grounded in CRM data"

    async def check(self, action: ProposedAction, context: ComplianceContext) -> RuleResult:
        if action.type not in ("email", "sms"):
            return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)

        body = action.content.get("body", "")
        crm_data = context.crm_data

        try:
            from app.ai.llm import chat, Message

            crm_summary = json.dumps(crm_data, default=str)[:2000]
            llm_response = await chat(
                messages=[
                    Message(
                        role="system",
                        content=(
                            "You are a fact-checker for sales communications. Compare the claims "
                            "in this message against the provided CRM data. Check if: "
                            "pricing matches product catalog, timelines are reasonable, "
                            "capabilities aren't invented. Respond with JSON only: "
                            '{"passed": true/false, "violations": ["..."], "feedback": "..."}'
                        ),
                    ),
                    Message(
                        role="user",
                        content=f"CRM DATA:\n{crm_summary}\n\nMESSAGE:\n{body}",
                    ),
                ],
                model_group="llama",
                team_id=context.team_id,
                user_id=context.team_id,
                run_id=context.team_id,
                agent_name="compliance_honesty",
            )

            if llm_response.content:
                try:
                    result = json.loads(llm_response.content)
                    if not result.get("passed", True):
                        return RuleResult(
                            passed=False,
                            rule_id=self.id,
                            rule_version=self.version,
                            violations=result.get("violations", []),
                            severity="warn",  # Soft block — rep can override
                            feedback=result.get(
                                "feedback",
                                "Factual claims may not be grounded in CRM data. Review before sending.",
                            ),
                        )
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.warning(f"Honesty LLM check failed: {e}")

        return RuleResult(passed=True, rule_id=self.id, rule_version=self.version)


@dataclass
class UniversalRulePack:
    """Universal rule pack — applies to all teams, always active."""

    id: str = "universal"
    version: str = "1.0"
    applies_to: str = "all"
    rules: list[ComplianceRule] = field(default_factory=lambda: [
        TCPAConsentRule(),
        CANSPAMRule(),
        GDPRCCPARule(),
        AntiDiscriminationRule(),
        HonestyRule(),
    ])
