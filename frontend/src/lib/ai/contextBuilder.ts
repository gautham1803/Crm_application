/** Context Builder — assembles rich CRM context for LLM prompts.
 *  Takes React Query data arrays as input (no global state).
 */
import type { Contact, Account, Deal } from "../api";

export interface ContactContext {
  contact: {
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    title: string;
    consentEmail: boolean;
    consentSms: boolean;
    consentSummary: string;
  };
  account: {
    name: string;
    domain: string;
    industry: string;
    size: string;
    annualRevenue: number;
  } | null;
  deals: {
    name: string;
    amount: number;
    stage: string;
    probability: number;
    closeDate: string;
  }[];
}

export interface AccountContext {
  account: {
    name: string;
    domain: string;
    industry: string;
    size: string;
    annualRevenue: number;
    contactsCount: number;
    activeDealsCount: number;
    totalPipelineValue: number;
  };
  contacts: {
    name: string;
    email: string;
    title: string;
    consentEmail: boolean;
    consentSms: boolean;
  }[];
  deals: {
    name: string;
    amount: number;
    stage: string;
    daysInStage: number;
  }[];
}

export interface DealContext {
  deal: {
    name: string;
    amount: number;
    stage: string;
    probability: number;
    closeDate: string;
    daysInStage: number;
    isStalled: boolean;
  };
  account: { name: string; industry: string; size: string; revenue: number } | null;
  primaryContact: { name: string; email: string; consentEmail: boolean } | null;
  contacts: { name: string; email: string; title: string; consentEmail: boolean; consentSms: boolean }[];
}

// ── Helpers ───────────────────────────────────────────
function daysInStage(deal: Deal): number {
  const updated = new Date(deal.updated_at).getTime();
  return Math.max(0, Math.floor((Date.now() - updated) / 86400000));
}

// ── Build Contact Context ─────────────────────────────
export function buildContactContext(
  contacts: Contact[],
  accounts: Account[],
  deals: Deal[],
  contactNameOrId: string
): ContactContext | null {
  const contact = contacts.find(
    (c) => c.id === contactNameOrId || `${c.first_name || ""} ${c.last_name || ""}`.trim() === contactNameOrId
  );
  if (!contact) return null;

  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  const account = contact.account_id ? accounts.find((a) => a.id === contact.account_id) : null;

  const consentParts: string[] = [];
  if (contact.consent_email) consentParts.push("email consent granted");
  else consentParts.push("NO email consent");
  if (contact.consent_sms) consentParts.push("SMS consent granted");
  else consentParts.push("NO SMS consent");

  const contactDeals = deals.filter((d) => d.contact_id === contact.id || d.account_id === contact.account_id);

  return {
    contact: {
      name: fullName,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phone: contact.phone || "",
      company: account?.name || "Independent",
      title: (contact.custom_fields as any)?.title || "Unknown title",
      consentEmail: contact.consent_email,
      consentSms: contact.consent_sms,
      consentSummary: consentParts.join(", "),
    },
    account: account
      ? {
          name: account.name,
          domain: account.domain || "",
          industry: account.industry || "Unknown",
          size: account.size || "Unknown",
          annualRevenue: account.annual_revenue || 0,
        }
      : null,
    deals: contactDeals.map((d) => ({
      name: d.name,
      amount: d.amount || 0,
      stage: d.stage?.name || "Unknown",
      probability: d.probability || 0,
      closeDate: d.expected_close_date || "",
    })),
  };
}

// ── Build Account Context ─────────────────────────────
export function buildAccountContext(
  accounts: Account[],
  contacts: Contact[],
  deals: Deal[],
  accountNameOrId: string
): AccountContext | null {
  const account = accounts.find((a) => a.id === accountNameOrId || a.name === accountNameOrId);
  if (!account) return null;

  const acctContacts = contacts.filter((c) => c.account_id === account.id);
  const acctDeals = deals.filter((d) => d.account_id === account.id);
  const totalPipeline = acctDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

  return {
    account: {
      name: account.name,
      domain: account.domain || "",
      industry: account.industry || "Unknown",
      size: account.size || "Unknown",
      annualRevenue: account.annual_revenue || 0,
      contactsCount: acctContacts.length,
      activeDealsCount: acctDeals.filter((d) => !d.stage?.is_won && !d.stage?.is_lost).length,
      totalPipelineValue: totalPipeline,
    },
    contacts: acctContacts.map((c) => ({
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      title: (c.custom_fields as any)?.title || "Unknown",
      consentEmail: c.consent_email,
      consentSms: c.consent_sms,
    })),
    deals: acctDeals.map((d) => ({
      name: d.name,
      amount: d.amount || 0,
      stage: d.stage?.name || "Unknown",
      daysInStage: daysInStage(d),
    })),
  };
}

// ── Build Deal Context ────────────────────────────────
export function buildDealContext(
  deals: Deal[],
  contacts: Contact[],
  accounts: Account[],
  dealNameOrId: string
): DealContext | null {
  const deal = deals.find((d) => d.id === dealNameOrId || d.name === dealNameOrId);
  if (!deal) return null;

  const account = deal.account_id ? accounts.find((a) => a.id === deal.account_id) : null;
  const primaryContact = deal.contact_id ? contacts.find((c) => c.id === deal.contact_id) : null;
  const acctContacts = deal.account_id ? contacts.filter((c) => c.account_id === deal.account_id) : [];
  const dis = daysInStage(deal);

  return {
    deal: {
      name: deal.name,
      amount: deal.amount || 0,
      stage: deal.stage?.name || "Unknown",
      probability: deal.probability || 0,
      closeDate: deal.expected_close_date || "",
      daysInStage: dis,
      isStalled: dis > 7,
    },
    account: account
      ? { name: account.name, industry: account.industry || "", size: account.size || "", revenue: account.annual_revenue || 0 }
      : null,
    primaryContact: primaryContact
      ? { name: `${primaryContact.first_name} ${primaryContact.last_name}`, email: primaryContact.email, consentEmail: primaryContact.consent_email }
      : null,
    contacts: acctContacts.map((c) => ({
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      title: (c.custom_fields as any)?.title || "",
      consentEmail: c.consent_email,
      consentSms: c.consent_sms,
    })),
  };
}
