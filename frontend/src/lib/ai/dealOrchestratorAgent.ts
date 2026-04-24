/** DealOrchestratorAgent — analyzes deal health and recommends actions via LLM */
import { callLLM } from "./llm";
import { buildDealContext } from "./contextBuilder";
import type { Contact, Account, Deal } from "../api";

export interface DealOrchestrationResult {
  dealHealth: "healthy" | "at_risk" | "stalled" | "critical";
  healthScore: number;
  analysis: string;
  immediateActions: { action: string; reason: string; urgency: string; type: string }[];
  stalledReason: string;
  winProbabilityAssessment: string;
  shouldDraftEmail: boolean;
  emailGoal: string;
  bestContactForEmail: string;
  model: string;
  cost: number;
}

export async function runDealOrchestratorAgent(opts: {
  deals: Deal[];
  contacts: Contact[];
  accounts: Account[];
  dealName: string;
}): Promise<DealOrchestrationResult | null> {
  const { deals, contacts, accounts, dealName } = opts;

  const dealCtx = buildDealContext(deals, contacts, accounts, dealName);
  if (!dealCtx) return null;

  const systemPrompt = `You are DealOrchestratorAgent for Acufy CRM. Analyze this deal and provide specific, actionable next steps. Consider the deal stage, days stalled, stakeholders, and any context.

Return ONLY this JSON:
{
  "dealHealth": "healthy" or "at_risk" or "stalled" or "critical",
  "healthScore": 0-100,
  "analysis": "2-3 sentence deal analysis",
  "immediateActions": [
    { "action": "specific action", "reason": "why", "urgency": "high" or "medium" or "low", "type": "email" or "call" or "meeting" or "task" }
  ],
  "stalledReason": "why it might be stalled, or empty string",
  "winProbabilityAssessment": "assessment of win likelihood",
  "shouldDraftEmail": true or false,
  "emailGoal": "what the email should accomplish",
  "bestContactForEmail": "name of the contact to email"
}`;

  const userPrompt = `Deal to analyze:
Name: ${dealCtx.deal.name}
Stage: ${dealCtx.deal.stage}
Amount: $${dealCtx.deal.amount.toLocaleString()}
Days in current stage: ${dealCtx.deal.daysInStage}
Is stalled (>7d): ${dealCtx.deal.isStalled ? "YES" : "No"}
Close date: ${dealCtx.deal.closeDate}
Probability: ${dealCtx.deal.probability}%
${dealCtx.account ? `Account: ${dealCtx.account.name} (${dealCtx.account.industry}, ${dealCtx.account.size})` : ""}

Primary contact: ${dealCtx.primaryContact ? `${dealCtx.primaryContact.name} (${dealCtx.primaryContact.email}, consent: ${dealCtx.primaryContact.consentEmail ? "YES" : "NO"})` : "None"}

Other contacts at account:
${dealCtx.contacts.map((c) => `- ${c.name} (${c.title}) — email consent: ${c.consentEmail ? "YES" : "NO"}`).join("\n") || "None"}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "llama",
      requireJSON: true,
      maxTokens: 700,
      temperature: 0.5,
      callerName: "DealOrchestratorAgent",
    });

    const parsed = result.content as any;
    return {
      dealHealth: parsed.dealHealth || "at_risk",
      healthScore: parsed.healthScore || 50,
      analysis: parsed.analysis || "",
      immediateActions: parsed.immediateActions || [],
      stalledReason: parsed.stalledReason || "",
      winProbabilityAssessment: parsed.winProbabilityAssessment || "",
      shouldDraftEmail: parsed.shouldDraftEmail || false,
      emailGoal: parsed.emailGoal || "",
      bestContactForEmail: parsed.bestContactForEmail || dealCtx.primaryContact?.name || "",
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[DealOrchestratorAgent] Failed:", e.message);
    return null;
  }
}
