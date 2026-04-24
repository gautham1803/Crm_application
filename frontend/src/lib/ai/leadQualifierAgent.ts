/** LeadQualifierAgent — BANT scoring via LLM */
import { callLLM } from "./llm";
import { buildContactContext } from "./contextBuilder";
import type { Contact, Account, Deal } from "../api";

export interface BANTScore {
  budget: { score: number; reasoning: string };
  authority: { score: number; reasoning: string };
  need: { score: number; reasoning: string };
  timeline: { score: number; reasoning: string };
}

export interface QualificationResult {
  bantScore: BANTScore;
  overallScore: number;
  qualification: "hot" | "warm" | "cold";
  keyInsights: string[];
  recommendedNextAction: string;
  model: string;
  cost: number;
}

export async function runLeadQualifierAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  contactName: string;
  additionalContext?: string;
}): Promise<QualificationResult | null> {
  const { contacts, accounts, deals, contactName, additionalContext = "" } = opts;

  const contactCtx = buildContactContext(contacts, accounts, deals, contactName);
  if (!contactCtx) return null;

  const systemPrompt = `You are LeadQualifierAgent for Acufy CRM. Score and qualify this lead using BANT criteria:
- Budget: Does the company have budget for CRM software?
- Authority: Is this person a decision-maker or influencer?
- Need: Do they have clear pain points that Acufy solves?
- Timeline: Is there urgency or a defined timeline?

Return ONLY this JSON:
{
  "bantScore": {
    "budget": { "score": 0-10, "reasoning": "1 sentence" },
    "authority": { "score": 0-10, "reasoning": "1 sentence" },
    "need": { "score": 0-10, "reasoning": "1 sentence" },
    "timeline": { "score": 0-10, "reasoning": "1 sentence" }
  },
  "overallScore": 0-100,
  "qualification": "hot" or "warm" or "cold",
  "keyInsights": ["insight 1", "insight 2"],
  "recommendedNextAction": "specific action to take"
}`;

  const userPrompt = `Lead to qualify:
Name: ${contactCtx.contact.name}
Email: ${contactCtx.contact.email}
Company: ${contactCtx.contact.company}
Title: ${contactCtx.contact.title}
${contactCtx.account ? `Industry: ${contactCtx.account.industry}\nCompany size: ${contactCtx.account.size}\nAnnual revenue: $${contactCtx.account.annualRevenue.toLocaleString()}` : ""}

Deals:
${contactCtx.deals.map((d) => `- ${d.name}: ${d.stage}, $${d.amount.toLocaleString()}`).join("\n") || "No active deals"}

Additional context: ${additionalContext || "None provided"}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "llama",
      requireJSON: true,
      maxTokens: 700,
      temperature: 0.5,
      callerName: "LeadQualifierAgent",
    });

    const parsed = result.content as any;
    return {
      bantScore: parsed.bantScore || { budget: { score: 5, reasoning: "" }, authority: { score: 5, reasoning: "" }, need: { score: 5, reasoning: "" }, timeline: { score: 5, reasoning: "" } },
      overallScore: parsed.overallScore || 50,
      qualification: parsed.qualification || "warm",
      keyInsights: parsed.keyInsights || [],
      recommendedNextAction: parsed.recommendedNextAction || "",
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[LeadQualifierAgent] Failed:", e.message);
    return null;
  }
}
