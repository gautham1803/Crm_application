/** AI Configuration — Acufy CRM
 *
 * Agent model groups
 * ──────────────────
 * Llama  (Groq):   LeadQualifier · Research · DealOrchestrator · Compliance
 * Mistral:         Nurturer · Scheduler · OpportunityWatch · Proposal
 * Fallback:        Gemini (both groups on primary failure)
 */

export const AI_CONFIG = {
  // ── Group 1: Llama via Groq ──────────────────────────────
  groq: {
    apiKey: import.meta.env.VITE_GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1",
    primaryModel: "llama-3.3-70b-versatile",
    fastModel: "llama-3.1-8b-instant",
  },

  // ── Group 2: Mistral ──────────────────────────────────────
  mistral: {
    apiKey: import.meta.env.VITE_MISTRAL_API_KEY || "",
    baseURL: "https://api.mistral.ai/v1",
    primaryModel: "mistral-large-latest",
  },

  // ── Fallback: Gemini ──────────────────────────────────────
  gemini: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || "",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-1.5-flash",
  },

  limits: {
    teamDailyBudgetUSD: 5.0,
    warningThresholdPct: 0.8,
  },

  costPer1kTokens: {
    // Llama group
    "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
    "llama-3.1-8b-instant":    { input: 0.00005, output: 0.00008 },
    // Mistral group
    "mistral-large-latest":    { input: 0.003,   output: 0.009 },
    // Fallback
    "gemini-1.5-flash":        { input: 0.000075, output: 0.0003 },
  } as Record<string, { input: number; output: number }>,
};

// ── Cost history ──────────────────────────────────────────────
export interface CostEntry {
  cost: number;
  model: string;
  modelGroup: string;
  caller: string;
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
}

let _todaySpend = 0;
const _costHistory: CostEntry[] = [];

export function recordAICost(
  cost: number,
  model: string,
  modelGroup: string,
  caller: string,
  promptTokens: number,
  completionTokens: number
) {
  _todaySpend += cost;
  _costHistory.push({ cost, model, modelGroup, caller, timestamp: Date.now(), promptTokens, completionTokens });
  console.log(
    `[AI Cost] ${caller} | ${modelGroup.toUpperCase()}:${model} | $${cost.toFixed(6)} | ` +
    `prompt=${promptTokens} compl=${completionTokens} | total=$${_todaySpend.toFixed(4)}`
  );
}

export function getTodaySpend(): number { return _todaySpend; }
export function getCostHistory(): CostEntry[] { return _costHistory; }

export function getBudgetStatus() {
  const limit = AI_CONFIG.limits.teamDailyBudgetUSD;
  const pct = _todaySpend / limit;
  return { spend: _todaySpend, limit, pct, overWarning: pct >= AI_CONFIG.limits.warningThresholdPct };
}
