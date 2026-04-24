/** ResearchAgent — generates business intelligence from CRM data via LLM */
import { callLLM } from "./llm";
import { buildAccountContext, buildContactContext } from "./contextBuilder";
import type { Contact, Account, Deal } from "../api";

export interface ResearchResult {
  companyOverview: string;
  news: string;
  growthSignals: string;
  techStack: string;
  buyingSignals: string;
  potentialObjections: string;
  talkingPoints: string[];
  recommendedNextAction: string;
  riskFactors: string;
  competitors: { name: string; category: string; weakness: string }[];
  competitorPainPoints: string[];
  positioningLine: string;
  researchedAt: string;
  model: string;
  cost: number;
}

export async function runResearchAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  targetName: string;
  targetType?: "account" | "contact";
}): Promise<ResearchResult | null> {
  const { contacts, accounts, deals, targetName, targetType = "account" } = opts;

  const systemPrompt = `You are ResearchAgent for Acufy CRM. Your job is to analyze the provided CRM data about a ${targetType} and generate realistic, useful business intelligence.

You must:
- Use ONLY the information provided in the CRM context
- Make reasonable inferences based on industry, company size, revenue, and deal history
- Generate insights that would genuinely help a sales rep prepare for their next interaction
- Be specific and actionable, not generic

Return ONLY this JSON structure:
{
  "companyOverview": "2-3 sentence company summary based on available data",
  "news": "Recent notable developments inferred from industry and context",
  "growthSignals": "Signs of expansion, hiring, or strategic shifts",
  "techStack": "Likely technology stack based on industry and size",
  "buyingSignals": "Reasons this company might be ready to buy now",
  "potentialObjections": "Likely concerns or objections to address",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "recommendedNextAction": "Most effective next action for this account",
  "riskFactors": "Potential risks or concerns for the deal",
  "competitors": [
    { "name": "Competitor name", "category": "CRM/Marketing/Sales Tool", "weakness": "Key weakness vs Acufy" }
  ],
  "competitorPainPoints": ["Pain point competitors don't address", "Another gap"],
  "positioningLine": "A subtle, non-aggressive competitive positioning sentence for outreach emails"
}`;

  let contextInfo = "";

  if (targetType === "account") {
    const ctx = buildAccountContext(accounts, contacts, deals, targetName);
    if (!ctx) return null;
    contextInfo = `Company: ${ctx.account.name}
Domain: ${ctx.account.domain}
Industry: ${ctx.account.industry}
Size: ${ctx.account.size}
Annual Revenue: $${ctx.account.annualRevenue.toLocaleString()}
Active deals: ${ctx.account.activeDealsCount}
Total pipeline: $${ctx.account.totalPipelineValue.toLocaleString()}
Contacts: ${ctx.contacts.map((c) => `${c.name} (${c.title})`).join(", ")}
Deal stages: ${ctx.deals.map((d) => `${d.name} — ${d.stage}`).join(", ")}`;
  } else {
    const ctx = buildContactContext(contacts, accounts, deals, targetName);
    if (!ctx) return null;
    contextInfo = `Contact: ${ctx.contact.name}
Email: ${ctx.contact.email}
Title: ${ctx.contact.title}
Company: ${ctx.contact.company}
Consent: ${ctx.contact.consentSummary}
Deals: ${ctx.deals.map((d) => `${d.name} (${d.stage})`).join(", ") || "None"}`;
    if (ctx.account) {
      contextInfo += `\nAccount Industry: ${ctx.account.industry}\nAccount Size: ${ctx.account.size}\nAccount Revenue: $${ctx.account.annualRevenue.toLocaleString()}`;
    }
  }

  const userPrompt = `CRM Data:\n${contextInfo}\n\nGenerate comprehensive business intelligence to help the sales rep prepare for their next interaction.`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "llama",
      requireJSON: true,
      maxTokens: 800,
      temperature: 0.6,
      callerName: "ResearchAgent",
    });

    const parsed = result.content as any;
    return {
      companyOverview: parsed.companyOverview || "",
      news: parsed.news || "",
      growthSignals: parsed.growthSignals || "",
      techStack: parsed.techStack || "",
      buyingSignals: parsed.buyingSignals || "",
      potentialObjections: parsed.potentialObjections || "",
      talkingPoints: parsed.talkingPoints || [],
      recommendedNextAction: parsed.recommendedNextAction || "",
      riskFactors: parsed.riskFactors || "",
      competitors: parsed.competitors || [],
      competitorPainPoints: parsed.competitorPainPoints || [],
      positioningLine: parsed.positioningLine || "",
      researchedAt: new Date().toLocaleTimeString(),
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[ResearchAgent] Failed:", e.message);
    return null;
  }
}
