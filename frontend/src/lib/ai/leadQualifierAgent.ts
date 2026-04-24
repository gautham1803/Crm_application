/** LeadQualifierAgent — Enhanced BANT scoring with weighted composite + confidence */
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
  confidenceLevel: "high" | "medium" | "low";
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

  const systemPrompt = `You are LeadQualifierAgent for Acufy CRM. Score and qualify this lead using BANT criteria with WEIGHTED scoring:

Scoring Rules:
- Each dimension scored 0-10 with a 1-sentence justification
- Weighted composite: Need (30%) + Budget (25%) + Authority (25%) + Timeline (20%)
- Overall score = weighted sum mapped to 0-100
- Classification: Hot (≥75), Warm (50-74), Cold (<50)
- Confidence: "high" if 3+ data fields available (title, company, industry, revenue, deals), "medium" if 2, "low" if 0-1

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
  "confidenceLevel": "high" or "medium" or "low",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
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

Additional context: ${additionalContext || "None provided"}

IMPORTANT: Calculate the weighted composite score as: (need_score * 3 + budget_score * 2.5 + authority_score * 2.5 + timeline_score * 2) to get a value out of 100.`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "llama",
      requireJSON: true,
      maxTokens: 800,
      temperature: 0.5,
      callerName: "LeadQualifierAgent",
    });

    const parsed = result.content as any;

    // Fallback BANT structure
    const bantScore = parsed.bantScore || {
      budget: { score: 5, reasoning: "Insufficient data" },
      authority: { score: 5, reasoning: "Insufficient data" },
      need: { score: 5, reasoning: "Insufficient data" },
      timeline: { score: 5, reasoning: "Insufficient data" },
    };

    // Calculate weighted score if LLM didn't do it correctly
    const weightedScore = Math.round(
      bantScore.need.score * 3 +
      bantScore.budget.score * 2.5 +
      bantScore.authority.score * 2.5 +
      bantScore.timeline.score * 2
    );
    const overallScore = Math.min(100, Math.max(0, parsed.overallScore || weightedScore));

    // Determine qualification based on score
    const qualification: "hot" | "warm" | "cold" =
      overallScore >= 75 ? "hot" : overallScore >= 50 ? "warm" : "cold";

    // Determine confidence
    let dataPoints = 0;
    if (contactCtx.contact.title) dataPoints++;
    if (contactCtx.contact.company) dataPoints++;
    if (contactCtx.account?.industry) dataPoints++;
    if (contactCtx.account?.annualRevenue) dataPoints++;
    if (contactCtx.deals.length > 0) dataPoints++;
    const confidenceLevel: "high" | "medium" | "low" =
      dataPoints >= 3 ? "high" : dataPoints >= 2 ? "medium" : "low";

    return {
      bantScore,
      overallScore,
      qualification,
      confidenceLevel: parsed.confidenceLevel || confidenceLevel,
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
