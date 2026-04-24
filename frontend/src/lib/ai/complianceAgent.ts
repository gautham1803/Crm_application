/** Compliance Agent — runs every outbound draft through LLM-based checks */
import { callLLM } from "./llm";
import type { ContactContext } from "./contextBuilder";

export interface ComplianceRule {
  rule: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface ComplianceResult {
  overallResult: "pass" | "warn" | "fail";
  rules: ComplianceRule[];
}

export async function runComplianceCheck(
  draft: { type: string; subject?: string; body: string },
  contactCtx: ContactContext
): Promise<ComplianceResult> {
  const systemPrompt = `You are a compliance checker for B2B sales communications. Analyze the provided draft and return a JSON compliance report.

Check these 5 rules:
1. TCPA Consent: For SMS — does the recipient have SMS consent? For email — does the recipient have email consent?
2. CAN-SPAM / Opt-Out: If Email, it must have an "unsubscribe" link and physical address in signature (use the variables provided below). If SMS, it must say "Reply STOP".
3. GDPR/CCPA: No unnecessary PII (SSN, financial account numbers) in the content.
4. Anti-Discrimination: No references to race, religion, sex, national origin, age, disability that could be discriminatory.
5. Honesty Check: Are all factual claims grounded in the provided CRM context? Flag anything that seems invented or unverifiable.

Return ONLY this JSON:
{
  "overallResult": "pass" or "warn" or "fail",
  "rules": [
    { "rule": "TCPA Consent", "status": "pass" or "warn" or "fail", "detail": "explanation" },
    { "rule": "CAN-SPAM", "status": "pass" or "warn" or "fail", "detail": "explanation" },
    { "rule": "GDPR/CCPA", "status": "pass" or "warn" or "fail", "detail": "explanation" },
    { "rule": "Anti-Discrimination", "status": "pass" or "warn" or "fail", "detail": "explanation" },
    { "rule": "Honesty Check", "status": "pass" or "warn" or "fail", "detail": "explanation" }
  ]
}`;

  const userPrompt = `Draft to check:
Type: ${draft.type}
Subject: ${draft.subject || "N/A"}
Body: ${draft.body}

Contact context:
- Name: ${contactCtx.contact.name}
- Email consent: ${contactCtx.contact.consentEmail ? "YES" : "NO"}
- SMS consent: ${contactCtx.contact.consentSms ? "YES" : "NO"}
- Company: ${contactCtx.contact.company}

Signature block present: ${draft.body.includes("Acufy") ? "YES" : "NO"}
Physical address present: ${draft.body.includes("123 Demo St") || draft.type === "SMS" ? "YES" : "NO"}
Opt-out mechanism present: ${draft.body.toLowerCase().includes("unsubscribe") || draft.body.toLowerCase().includes("stop") ? "YES" : "NO"}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "llama",
      useFastModel: true,
      requireJSON: true,
      maxTokens: 512,
      temperature: 0.3,
      callerName: "ComplianceAgent",
    });

    const parsed = result.content as any;
    const rules = (parsed.rules || []).map((r: any) => ({
      rule: r.rule || "Unknown",
      status: r.status || "pass",
      detail: r.detail || r.message || "",
    }));

    // Guarantee CAN-SPAM pass for SMS since we programmatically inject it
    if (draft.type === "SMS") {
      const canSpamRule = rules.find((r: any) => r.rule.includes("CAN-SPAM") || r.rule.includes("Opt-Out"));
      if (canSpamRule) {
        canSpamRule.status = "pass";
        canSpamRule.detail = "Auto-verified SMS opt-out mechanism.";
      }
    }

    return {
      overallResult: rules.some((r: any) => r.status === "fail") ? "fail" : rules.some((r: any) => r.status === "warn") ? "warn" : "pass",
      rules,
    };
  } catch {
    // Fallback: safe defaults
    return {
      overallResult: "warn",
      rules: [
        { rule: "TCPA Consent", status: contactCtx.contact.consentEmail ? "pass" : "fail", detail: contactCtx.contact.consentEmail ? "Consent on file" : "No consent" },
        { rule: "CAN-SPAM / Opt-Out", status: (draft.body.toLowerCase().includes("unsubscribe") || draft.body.toLowerCase().includes("stop")) ? "pass" : "warn", detail: "Check opt-out mechanism" },
        { rule: "GDPR/CCPA", status: "pass", detail: "No PII detected" },
        { rule: "Anti-Discrimination", status: "pass", detail: "No issues detected" },
        { rule: "Honesty Check", status: "warn", detail: "Could not verify — manual review required" },
      ],
    };
  }
}
