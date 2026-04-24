/** NurturerAgent — drafts real personalized emails/SMS using LLM + CRM context */
import { callLLM } from "./llm";
import { buildContactContext, buildDealContext } from "./contextBuilder";
import { runComplianceCheck } from "./complianceAgent";
import type { Contact, Account, Deal } from "../api";

export interface NurturerResult {
  approval: {
    id: string;
    type: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    companyName: string;
    dealName: string;
    dealStage: string;
    agentName: string;
    subject: string;
    body: string;
    reasoning: string;
    compliance: { rule: string; status: string; detail: string }[];
    expiresIn: string;
    expiresUrgent: boolean;
    dismissed: boolean;
  };
  cost: number;
}

export type GoalType = "first_touch" | "follow_up" | "re_engage" | "post_close" | "nurture" | "qualification";

const GOAL_DESCRIPTIONS: Record<string, string> = {
  first_touch: "Write a first-touch cold outreach introducing Acufy CRM and its AI-powered sales features",
  follow_up: "Write a follow-up after a previous interaction, demo, or meeting",
  re_engage: "Re-engage a contact who has gone silent or not responded",
  post_close: "Send a thank-you and onboarding next steps after winning a deal",
  nurture: "Send a value-add nurture message to keep the relationship warm",
  qualification: "Reach out to qualify this lead and understand their needs better",
};

export async function runNurturerAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  contactName: string;
  dealName?: string;
  goalType: GoalType;
  outputType?: "EMAIL" | "SMS";
}): Promise<NurturerResult | null> {
  const { contacts, accounts, deals, contactName, dealName, goalType, outputType = "EMAIL" } = opts;

  const contactCtx = buildContactContext(contacts, accounts, deals, contactName);
  if (!contactCtx) {
    throw new Error(`Contact "${contactName}" not found in CRM data`);
  }

  // Consent check
  if (outputType === "EMAIL" && !contactCtx.contact.consentEmail) {
    throw new Error(`Contact "${contactName}" has not granted email consent`);
  }
  if (outputType === "SMS" && !contactCtx.contact.consentSms) {
    throw new Error(`Contact "${contactName}" has not granted SMS consent`);
  }

  const dealCtx = dealName ? buildDealContext(deals, contacts, accounts, dealName) : null;

  const accountDesc = contactCtx.account
    ? `Account: ${contactCtx.account.name}\nIndustry: ${contactCtx.account.industry}\nCompany size: ${contactCtx.account.size}\nAnnual revenue: $${contactCtx.account.annualRevenue?.toLocaleString()}\nDomain: ${contactCtx.account.domain}`
    : "Independent contact (B2C)";

  const dealDesc = dealCtx
    ? `Active Deal: ${dealCtx.deal.name}\nAmount: $${dealCtx.deal.amount.toLocaleString()}\nStage: ${dealCtx.deal.stage}\nDays in stage: ${dealCtx.deal.daysInStage}\nStalled: ${dealCtx.deal.isStalled ? "YES" : "No"}\nClose date: ${dealCtx.deal.closeDate}\nProbability: ${dealCtx.deal.probability}%`
    : contactCtx.deals.length > 0
      ? `Deals:\n${contactCtx.deals.map((d) => `- ${d.name}: ${d.stage}, $${d.amount.toLocaleString()}`).join("\n")}`
      : "No active deals";

  const systemPrompt = `You are an expert B2B sales rep at Acufy, a modern AI-powered CRM platform. You write highly personalized, concise, and effective sales emails and SMS messages.

Your writing style:
- Professional but conversational, never robotic
- Specific — always reference real details from the CRM context provided
- Empathetic — acknowledge their situation and challenges
- Clear CTA — one specific next step, never vague
- Concise — emails under 200 words, SMS under 160 characters
- Never use generic phrases like "I hope this email finds you well"
- Never make up information not in the context provided

For emails, ALWAYS end with:
— Acufy Sales Team | 123 Demo St, New York NY 10001
Unsubscribe

For SMS, ALWAYS end with:
Reply STOP to opt out

Return ONLY a JSON object:
{
  "subject": "email subject line (empty string for SMS)",
  "body": "full message body with proper line breaks using actual newlines",
  "reasoning": "2-3 sentences explaining your strategy and why you wrote it this way"
}`;

  const userPrompt = `Goal: ${GOAL_DESCRIPTIONS[goalType] || goalType}
Output type: ${outputType}

--- CONTACT ---
Name: ${contactCtx.contact.name}
Email: ${contactCtx.contact.email}
Phone: ${contactCtx.contact.phone}
Title: ${contactCtx.contact.title}
Consent: ${contactCtx.contact.consentSummary}
${accountDesc}

--- DEAL CONTEXT ---
${dealDesc}

Write a highly personalized ${outputType.toLowerCase()} using ALL relevant details above.`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "mistral",
      requireJSON: true,
      maxTokens: 600,
      temperature: 0.75,
      callerName: "NurturerAgent",
    });

    const draft = result.content as any;
    const subject = draft.subject || "";
    let body = draft.body || "Draft could not be generated.";
    const reasoning = draft.reasoning || "";

    // Guarantee opt-out for SMS
    if (outputType === "SMS" && !body.toLowerCase().includes("stop")) {
        body += "\n\nReply STOP to opt out";
    }

    // Run compliance
    const compliance = await runComplianceCheck({ type: outputType, subject, body }, contactCtx);

    const approval = {
      id: `apr-${Date.now()}`,
      type: outputType,
      contactName: contactCtx.contact.name,
      contactEmail: contactCtx.contact.email,
      contactPhone: contactCtx.contact.phone,
      companyName: contactCtx.contact.company,
      dealName: dealCtx?.deal.name || (contactCtx.deals[0]?.name ?? "General Outreach"),
      dealStage: dealCtx?.deal.stage || (contactCtx.deals[0]?.stage ?? "N/A"),
      agentName: "NurturerAgent",
      subject,
      body,
      reasoning: `// NurturerAgent reasoning trace\n${reasoning}\n// Model: ${result.model} | Cost: $${result.cost.toFixed(6)}`,
      compliance: compliance.rules.map((r) => ({ rule: r.rule, status: r.status, detail: r.detail })),
      expiresIn: "23h 59m",
      expiresUrgent: false,
      dismissed: false,
    };

    return { approval, cost: result.cost };
  } catch (e: any) {
    console.error("[NurturerAgent] Failed:", e.message);
    throw new Error(e.message);
  }
}
