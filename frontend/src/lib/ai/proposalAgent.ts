/** ProposalAgent — generates a complete sales proposal document for a deal.
 *  Model group: Mistral
 */
import { callLLM } from "./llm";
import { buildDealContext } from "./contextBuilder";
import type { Contact, Account, Deal } from "../api";

export interface ProposalLineItem {
  item: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ProposalPhase {
  phase: string;
  duration: string;
  milestones: string[];
}

export interface ProposalResult {
  title: string;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  pricingTable: ProposalLineItem[];
  totalAcv: number;
  paymentTerms: string;
  implementationTimeline: ProposalPhase[];
  whyUs: string[];
  nextSteps: string;
  validUntil: string;
  summary: string;
  model: string;
  cost: number;
}

export async function runProposalAgent(opts: {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  dealName: string;
}): Promise<ProposalResult | null> {
  const { contacts, accounts, deals, dealName } = opts;

  const dealCtx = buildDealContext(deals, contacts, accounts, dealName);
  if (!dealCtx) return null;

  const systemPrompt = `You are ProposalAgent for Acufy CRM. Generate a complete, professional sales proposal document.

The proposal must include:
1. Executive Summary — tailored to this specific company and their situation
2. Problem Statement — their pain points based on the deal context
3. Proposed Solution — how Acufy solves their problems
4. Pricing table — itemised line items based on the deal amount
5. Implementation timeline — phased onboarding plan
6. Why Acufy — 3 differentiators specific to their industry
7. Next Steps — clear CTA

Return ONLY this JSON:
{
  "title": "Proposal: [Company] x Acufy CRM",
  "executiveSummary": "...",
  "problemStatement": "...",
  "proposedSolution": "...",
  "pricingTable": [
    { "item": "Acufy CRM Enterprise License", "qty": 1, "unitPrice": 0, "total": 0 }
  ],
  "totalAcv": 0,
  "paymentTerms": "Annual, net 30",
  "implementationTimeline": [
    { "phase": "Phase 1 — Setup", "duration": "Week 1-2", "milestones": ["Data migration", "Team onboarding"] }
  ],
  "whyUs": ["differentiator 1", "differentiator 2", "differentiator 3"],
  "nextSteps": "...",
  "validUntil": "30 days from proposal date",
  "summary": "One-sentence summary for the CRM record"
}`;

  const userPrompt = `Generate a proposal for:
Deal: ${dealCtx.deal.name}
Amount: $${dealCtx.deal.amount.toLocaleString()}
Stage: ${dealCtx.deal.stage}
Close date: ${dealCtx.deal.closeDate}
Probability: ${dealCtx.deal.probability}%
${dealCtx.account ? `Company: ${dealCtx.account.name}\nIndustry: ${dealCtx.account.industry}\nSize: ${dealCtx.account.size}\nRevenue: $${dealCtx.account.revenue.toLocaleString()}` : ""}
Primary contact: ${dealCtx.primaryContact ? `${dealCtx.primaryContact.name} (${dealCtx.primaryContact.email})` : "Unknown"}`;

  try {
    const result = await callLLM({
      systemPrompt,
      userPrompt,
      modelGroup: "mistral",
      requireJSON: true,
      maxTokens: 4000,
      temperature: 0.6,
      callerName: "ProposalAgent",
    });

    const parsed = result.content as any;
    return {
      title: parsed.title || `Proposal: ${dealName}`,
      executiveSummary: parsed.executiveSummary || "",
      problemStatement: parsed.problemStatement || "",
      proposedSolution: parsed.proposedSolution || "",
      pricingTable: (parsed.pricingTable || []).map((item: any) => ({
        item: item.item || "",
        qty: item.qty || 1,
        unitPrice: item.unitPrice || dealCtx.deal.amount,
        total: item.total || dealCtx.deal.amount,
      })),
      totalAcv: parsed.totalAcv || dealCtx.deal.amount,
      paymentTerms: parsed.paymentTerms || "Annual, net 30",
      implementationTimeline: parsed.implementationTimeline || [],
      whyUs: parsed.whyUs || [],
      nextSteps: parsed.nextSteps || "",
      validUntil: parsed.validUntil || "30 days from proposal date",
      summary: parsed.summary || `Proposal for ${dealName}`,
      model: result.model,
      cost: result.cost,
    };
  } catch (e: any) {
    console.error("[ProposalAgent] Failed:", e.message);
    return null;
  }
}
