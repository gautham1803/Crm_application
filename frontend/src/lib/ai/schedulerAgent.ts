/** SchedulerAgent — finds meeting times and drafts scheduling emails.
 *  Model group: Mistral
 */
import { callLLM } from "./llm";
import { buildDealContext } from "./contextBuilder";
import { runComplianceCheck } from "./complianceAgent";
import type { Contact, Account, Deal } from "../api";

export interface ProposedTime {
  datetime: string;
  label: string;
}

export interface SchedulerResult {
  proposedTimes: ProposedTime[];
  meetingType: string;
  durationMinutes: number;
  subject: string;
  emailBody: string;
  description: string;
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
  model: string;
  cost: number;
}

export async function runSchedulerAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  dealName: string;
}): Promise<SchedulerResult | null> {
  const { contacts, accounts, deals, dealName } = opts;

  const dealCtx = buildDealContext(deals, contacts, accounts, dealName);
  if (!dealCtx) return null;

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const systemPrompt = `You are SchedulerAgent for Acufy CRM. Find 3 available meeting times and draft a professional scheduling email.

The times should be:
- Business hours (9am–5pm, Mon–Fri)
- Within the next 2 weeks
- Spaced across different days/times for flexibility

Match the meeting type to the deal stage:
- Discovery/Prospecting → intro call (30 min)
- Qualification/Demo → demo meeting (45-60 min)
- Proposal/Negotiation → proposal review (60 min)
- Closing → final discussion (30-45 min)

Return ONLY this JSON:
{
  "proposedTimes": [
    { "datetime": "YYYY-MM-DDTHH:MM:00", "label": "Thursday Apr 24 at 2:00 PM" },
    { "datetime": "YYYY-MM-DDTHH:MM:00", "label": "Friday Apr 25 at 10:00 AM" },
    { "datetime": "YYYY-MM-DDTHH:MM:00", "label": "Monday Apr 28 at 3:00 PM" }
  ],
  "meetingType": "demo|discovery|proposal_review|negotiation|intro_call",
  "durationMinutes": 30,
  "subject": "email subject line",
  "description": "internal calendar event description",
  "emailBody": "full email body — professional, personalized, references the deal context"
}`;

  const userPrompt = `Schedule a meeting for this deal:
Deal: ${dealCtx.deal.name}
Stage: ${dealCtx.deal.stage}
Amount: $${dealCtx.deal.amount.toLocaleString()}
Days in stage: ${dealCtx.deal.daysInStage}
Contact: ${dealCtx.primaryContact ? `${dealCtx.primaryContact.name} (${dealCtx.primaryContact.email})` : "Unknown"}
${dealCtx.account ? `Company: ${dealCtx.account.name} (${dealCtx.account.industry})` : ""}

Today's date: ${today.toDateString()}
Schedule times between now and: ${nextWeek.toDateString()}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "mistral",
      requireJSON: true,
      maxTokens: 800,
      temperature: 0.5,
      callerName: "SchedulerAgent",
    });

    const parsed = result.content as any;

    const emailBody = parsed.emailBody || "";
    const subject = parsed.subject || `Meeting Request: ${dealCtx.deal.name}`;

    // Build a minimal contact context for compliance
    const primaryContactFull = dealCtx.primaryContact
      ? { contact: { name: dealCtx.primaryContact.name, email: dealCtx.primaryContact.email, phone: "", company: dealCtx.account?.name || "", title: "", consentEmail: dealCtx.primaryContact.consentEmail, consentSms: false, consentSummary: dealCtx.primaryContact.consentEmail ? "email consent granted" : "NO email consent", firstName: "", lastName: "" }, account: null, deals: [] }
      : null;

    let compliance = [{ rule: "CAN-SPAM", status: "pass" as const, detail: "Scheduling email" }];
    if (primaryContactFull) {
      const complianceResult = await runComplianceCheck({ type: "EMAIL", subject, body: emailBody }, primaryContactFull);
      compliance = complianceResult.rules.map((r) => ({ rule: r.rule, status: r.status, detail: r.detail }));
    }

    const approval = {
      id: `apr-${Date.now()}`,
      type: "EMAIL",
      contactName: dealCtx.primaryContact?.name || "Unknown",
      contactEmail: dealCtx.primaryContact?.email || "",
      contactPhone: "",
      companyName: dealCtx.account?.name || "",
      dealName: dealCtx.deal.name,
      dealStage: dealCtx.deal.stage,
      agentName: "SchedulerAgent",
      subject,
      body: emailBody,
      reasoning: `// SchedulerAgent reasoning\n// Meeting type: ${parsed.meetingType || "meeting"}\n// Duration: ${parsed.durationMinutes || 30} min\n// Proposed times: ${(parsed.proposedTimes || []).map((t: any) => t.label).join(", ")}\n// Model: ${result.model} | Cost: $${result.cost.toFixed(6)}`,
      compliance,
      expiresIn: "23h 59m",
      expiresUrgent: false,
      dismissed: false,
    };

    return {
      proposedTimes: parsed.proposedTimes || [],
      meetingType: parsed.meetingType || "meeting",
      durationMinutes: parsed.durationMinutes || 30,
      subject,
      emailBody,
      description: parsed.description || "",
      approval,
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[SchedulerAgent] Failed:", e.message);
    return null;
  }
}
