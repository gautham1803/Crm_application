/** OpportunityWatchAgent — surfaces buying signals and recommends outreach timing.
 *  Model group: Mistral
 */
import { callLLM } from "./llm";
import { buildAccountContext, buildContactContext } from "./contextBuilder";
import type { Contact, Account, Deal } from "../api";

export interface OpportunitySignal {
  signal: string;
  strength: "strong" | "medium" | "weak";
  source: string;
}

export interface OpportunityWatchResult {
  signalsFound: OpportunitySignal[];
  opportunityScore: number;
  recommendedTiming: "immediate" | "this_week" | "this_month" | "not_now";
  outreachAngle: string;
  alertMessage: string;
  talkingPoints: string[];
  riskFactors: string[];
  summary: string;
  expansionSignals: { signal: string; strength: string; source: string }[];
  expansionReadiness: number;
  checkInDue: boolean;
  model: string;
  cost: number;
}

export async function runOpportunityWatchAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  targetName: string;
  targetType?: "account" | "contact";
}): Promise<OpportunityWatchResult | null> {
  const { contacts, accounts, deals, targetName, targetType = "account" } = opts;

  let contextInfo = "";
  if (targetType === "account") {
    const ctx = buildAccountContext(accounts, contacts, deals, targetName);
    if (!ctx) return null;
    contextInfo = `Company: ${ctx.account.name}
Industry: ${ctx.account.industry}
Size: ${ctx.account.size}
Annual Revenue: $${ctx.account.annualRevenue.toLocaleString()}
Active deals: ${ctx.account.activeDealsCount}
Pipeline value: $${ctx.account.totalPipelineValue.toLocaleString()}
Contacts: ${ctx.contacts.map((c) => `${c.name} (${c.title})`).join(", ")}
Recent deals: ${ctx.deals.map((d) => `${d.name} — ${d.stage} — $${d.amount.toLocaleString()}`).join(", ")}`;
  } else {
    const ctx = buildContactContext(contacts, accounts, deals, targetName);
    if (!ctx) return null;
    contextInfo = `Contact: ${ctx.contact.name}
Title: ${ctx.contact.title}
Company: ${ctx.contact.company}
${ctx.account ? `Industry: ${ctx.account.industry}\nSize: ${ctx.account.size}` : ""}
Deals: ${ctx.deals.map((d) => `${d.name} (${d.stage})`).join(", ") || "None"}`;
  }

  const systemPrompt = `You are OpportunityWatchAgent for Acufy CRM. Analyze account/contact data and identify buying signals that indicate this is a good (or bad) time to reach out.

Look for:
- Expansion signals (hiring, new offices, funding)
- Leadership changes (new CTO, VP of Sales, Head of IT)
- Technology migration signals
- Contract renewal windows (based on deal ages)
- Competitive displacement opportunities
- Industry regulatory or market shifts

Return ONLY this JSON:
{
  "signalsFound": [
    { "signal": "description", "strength": "strong|medium|weak", "source": "data point" }
  ],
  "opportunityScore": 0-100,
  "recommendedTiming": "immediate|this_week|this_month|not_now",
  "outreachAngle": "the specific angle to use when reaching out",
  "alertMessage": "one-line alert for the rep (start with emoji)",
  "talkingPoints": ["point 1", "point 2"],
  "riskFactors": ["risk 1"],
  "summary": "2-3 sentence summary of the opportunity",
  "expansionSignals": [
    { "signal": "Expansion opportunity description", "strength": "strong|medium|weak", "source": "data source" }
  ],
  "expansionReadiness": 0-100,
  "checkInDue": true or false
}`;

  const userPrompt = `Analyze for buying signals and optimal outreach timing:\n${contextInfo}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "mistral",
      requireJSON: true,
      maxTokens: 700,
      temperature: 0.6,
      callerName: "OpportunityWatchAgent",
    });

    const parsed = result.content as any;
    return {
      signalsFound: parsed.signalsFound || [],
      opportunityScore: parsed.opportunityScore || 50,
      recommendedTiming: parsed.recommendedTiming || "this_month",
      outreachAngle: parsed.outreachAngle || "",
      alertMessage: parsed.alertMessage || `🔔 Opportunity detected for ${targetName}`,
      talkingPoints: parsed.talkingPoints || [],
      riskFactors: parsed.riskFactors || [],
      summary: parsed.summary || "",
      expansionSignals: parsed.expansionSignals || [],
      expansionReadiness: parsed.expansionReadiness || 0,
      checkInDue: parsed.checkInDue || false,
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[OpportunityWatchAgent] Failed:", e.message);
    return null;
  }
}
