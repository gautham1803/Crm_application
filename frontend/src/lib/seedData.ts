/** Seed data constants — consistent across all pages */

export interface SeedAccount {
  name: string;
  domain: string;
  industry: string;
  size: string;
  revenue: number;
  contactsCount: number;
  dealsCount: number;
}

export interface DealMeta {
  contactOrAccount: string;
  type: "B2B" | "B2C";
  closeDate: string;
  daysInStage: number;
}

export const SEED_ACCOUNTS: Record<string, SeedAccount> = {
  "TechVista Solutions": {
    name: "TechVista Solutions", domain: "techvista.com", industry: "Technology",
    size: "51-200", revenue: 12_000_000, contactsCount: 3, dealsCount: 1,
  },
  "GreenLeaf Manufacturing": {
    name: "GreenLeaf Manufacturing", domain: "greenleafmfg.com", industry: "Manufacturing",
    size: "201-500", revenue: 45_000_000, contactsCount: 2, dealsCount: 1,
  },
  "Meridian Healthcare": {
    name: "Meridian Healthcare", domain: "meridianhc.com", industry: "Healthcare",
    size: "501-1000", revenue: 120_000_000, contactsCount: 3, dealsCount: 1,
  },
  "Atlas Financial Group": {
    name: "Atlas Financial Group", domain: "atlasfinancial.com", industry: "Financial Services",
    size: "201-500", revenue: 80_000_000, contactsCount: 2, dealsCount: 1,
  },
  "NovaStar Media": {
    name: "NovaStar Media", domain: "novastarmedia.com", industry: "Media",
    size: "11-50", revenue: 5_000_000, contactsCount: 1, dealsCount: 1,
  },
};

export const SEED_DEAL_META: Record<string, DealMeta> = {
  "Alex Johnson Pro Plan": {
    contactOrAccount: "Alex Johnson", type: "B2C", closeDate: "2026-05-05", daysInStage: 2,
  },
  "Atlas Financial Suite": {
    contactOrAccount: "Atlas Financial Group", type: "B2B", closeDate: "2026-05-20", daysInStage: 3,
  },
  "Ryan Davis Starter": {
    contactOrAccount: "Ryan Davis", type: "B2C", closeDate: "2026-05-10", daysInStage: 6,
  },
  "Meridian CRM Migration": {
    contactOrAccount: "Meridian Healthcare", type: "B2B", closeDate: "2026-06-15", daysInStage: 14,
  },
  "TechVista Enterprise License": {
    contactOrAccount: "TechVista Solutions", type: "B2B", closeDate: "2026-05-30", daysInStage: 5,
  },
  "Chris Williams Enterprise": {
    contactOrAccount: "Chris Williams", type: "B2C", closeDate: "2026-05-25", daysInStage: 4,
  },
  "GreenLeaf Digital Transform.": {
    contactOrAccount: "GreenLeaf Manufacturing", type: "B2B", closeDate: "2026-06-01", daysInStage: 9,
  },
  "GreenLeaf Digital Transformation": {
    contactOrAccount: "GreenLeaf Manufacturing", type: "B2B", closeDate: "2026-06-01", daysInStage: 9,
  },
  "NovaStar Starter": {
    contactOrAccount: "NovaStar Media", type: "B2B", closeDate: "2026-04-15", daysInStage: 0,
  },
};

/** Look up deal meta by name — fuzzy match on startsWith */
export function getDealMeta(dealName: string): DealMeta | null {
  if (SEED_DEAL_META[dealName]) return SEED_DEAL_META[dealName];
  // Fuzzy match: try startsWith
  for (const [key, val] of Object.entries(SEED_DEAL_META)) {
    if (dealName.startsWith(key.slice(0, 12)) || key.startsWith(dealName.slice(0, 12))) return val;
  }
  return null;
}

/** Look up account seed data by name — fuzzy match */
export function getAccountSeed(accountName: string): SeedAccount | null {
  if (SEED_ACCOUNTS[accountName]) return SEED_ACCOUNTS[accountName];
  for (const [key, val] of Object.entries(SEED_ACCOUNTS)) {
    if (accountName.toLowerCase().includes(key.slice(0, 8).toLowerCase())) return val;
  }
  return null;
}

export const CONTACTS_SUMMARY = {
  total: 20,
  emailConsent: 14,
  smsConsent: 10,
  noConsent: 3,
};

/** Simulated approval data for the 3 pending approvals */
export const SEED_APPROVALS = [
  {
    id: "approval-1",
    type: "EMAIL",
    contactName: "Robert Kim",
    contactEmail: "rkim@meridianhealth.com",
    contactPhone: "+1 (555) 234-8901",
    companyName: "Meridian Healthcare",
    dealName: "Meridian CRM Migration",
    dealStage: "Demo/Meeting",
    agentName: "NurturerAgent",
    subject: "Following Up on Our Demo — Next Steps for Meridian",
    body: `Hi Robert,

I wanted to follow up on our demo conversation last week. Based on your team's needs around data migration and CRM integration, I believe we can have you fully onboarded within 6 weeks.

I've attached a tailored implementation timeline and would love to schedule a 30-minute call to walk through it together. Does Thursday or Friday this week work for you?

Looking forward to hearing from you.

— Acufy Sales Team | 123 Demo St, New York NY 10001
Unsubscribe`,
    compliance: [
      { rule: "TCPA Consent", status: "pass" as const, detail: "Email consent granted on 2026-03-15 via web form" },
      { rule: "CAN-SPAM", status: "pass" as const, detail: "Unsubscribe link and physical address present" },
      { rule: "GDPR/CCPA", status: "pass" as const, detail: "Data processing consent verified" },
      { rule: "Anti-Discrimination", status: "pass" as const, detail: "No discriminatory language detected" },
      { rule: "Honesty Check", status: "warn" as const, detail: "\"6 weeks onboarding\" not in product catalog — verify timeline accuracy" },
    ],
    reasoning: `// NurturerAgent reasoning trace
// Goal: follow_up after demo, deal stage = Demo/Meeting
// Last activity: 14 days ago (demo call logged)
// Contact score: 72/100 (BANT: Budget confirmed, Authority: Decision maker)
// Trigger: DealOrchestratorAgent flagged deal as stalled (14d in stage)
// Strategy: Re-engage with next-step CTA, reference demo context
// Compliance pre-check: email consent ✓, unsubscribe injected ✓
// Confidence: 0.84`,
    expiresIn: "3h 42m",
    expiresUrgent: false,
  },
  {
    id: "approval-2",
    type: "SMS",
    contactName: "Sarah Chen",
    contactEmail: "schen@techvista.com",
    contactPhone: "+1 (555) 891-2345",
    companyName: "TechVista Solutions",
    dealName: "TechVista Enterprise License",
    dealStage: "Proposal",
    agentName: "NurturerAgent",
    subject: "",
    body: `Hi Sarah! Quick check-in on the enterprise proposal. Would you have 15 mins this week to discuss pricing? We can tailor the package to fit your team's needs. — Acufy`,
    compliance: [
      { rule: "TCPA Consent", status: "pass" as const, detail: "SMS consent granted on 2026-03-20 via web form" },
      { rule: "CAN-SPAM", status: "pass" as const, detail: "N/A for SMS" },
      { rule: "GDPR/CCPA", status: "pass" as const, detail: "Data processing consent verified" },
      { rule: "Anti-Discrimination", status: "pass" as const, detail: "No discriminatory language detected" },
      { rule: "Honesty Check", status: "pass" as const, detail: "No unverified claims detected" },
    ],
    reasoning: `// NurturerAgent reasoning trace
// Goal: follow_up on proposal, deal stage = Proposal
// Last activity: 5 days ago (proposal sent)
// Contact score: 81/100 (BANT: Budget TBD, Authority: Tech Lead)
// Strategy: Gentle check-in via preferred channel (SMS)
// Compliance pre-check: SMS consent ✓
// Confidence: 0.91`,
    expiresIn: "18h 0m",
    expiresUrgent: false,
  },
  {
    id: "approval-3",
    type: "EMAIL",
    contactName: "James Foster",
    contactEmail: "jfoster@greenleafmfg.com",
    contactPhone: "+1 (555) 456-7890",
    companyName: "GreenLeaf Manufacturing",
    dealName: "GreenLeaf Digital Transformation",
    dealStage: "Negotiation",
    agentName: "DealOrchestratorAgent",
    subject: "Digital Transformation Proposal — Updated Pricing for GreenLeaf",
    body: `Dear James,

Thank you for the productive negotiation session last week. As discussed, I've prepared an updated pricing structure that reflects the multi-year commitment discount.

Key highlights:
• 15% discount on Year 1 implementation
• Dedicated migration team for 8 weeks
• 24/7 priority support included

I'd love to walk through the numbers on a call this week. Are you available Tuesday or Wednesday afternoon?

Best regards,
Acufy Sales Team | 123 Demo St, New York NY 10001
Unsubscribe`,
    compliance: [
      { rule: "TCPA Consent", status: "pass" as const, detail: "Email consent granted on 2026-02-10" },
      { rule: "CAN-SPAM", status: "pass" as const, detail: "Unsubscribe link and physical address present" },
      { rule: "GDPR/CCPA", status: "pass" as const, detail: "Data processing consent verified" },
      { rule: "Anti-Discrimination", status: "pass" as const, detail: "No discriminatory language detected" },
      { rule: "Honesty Check", status: "pass" as const, detail: "Pricing verified against catalog" },
    ],
    reasoning: `// DealOrchestratorAgent reasoning trace
// Goal: advance negotiation, deal stage = Negotiation (9d)
// Last activity: 9 days ago (negotiation call)
// Contact score: 88/100 (BANT: All confirmed)
// Trigger: Stalled deal (>7d in Negotiation)
// Strategy: Send updated pricing to move to close
// Compliance pre-check: email consent ✓, unsubscribe injected ✓
// Confidence: 0.87`,
    expiresIn: "22h 15m",
    expiresUrgent: false,
  },
];
