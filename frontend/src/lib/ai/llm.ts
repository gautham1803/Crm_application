/** Core LLM caller — dual-model routing with Gemini fallback.
 *
 * modelGroup="llama"   → Groq Llama-3.3-70b  (LeadQualifier, Research, DealOrchestrator, Compliance)
 * modelGroup="mistral" → Mistral Large         (Nurturer, Scheduler, OpportunityWatch, Proposal)
 * fallback             → Gemini 1.5 Flash      (both groups on primary failure)
 */
import { AI_CONFIG, recordAICost, getBudgetStatus } from "./aiConfig";
import { showToast } from "../../components/Toast";

export type ModelGroup = "llama" | "mistral";

export interface LLMResult {
  content: string | Record<string, any>;
  cost: number;
  model: string;
  modelGroup: ModelGroup;
  promptTokens: number;
  completionTokens: number;
}

export interface CallLLMOptions {
  systemPrompt: string;
  userPrompt: string;
  modelGroup?: ModelGroup;
  useFastModel?: boolean;
  requireJSON?: boolean;
  maxTokens?: number;
  temperature?: number;
  callerName?: string;
}

// ── Main entry point ──────────────────────────────────────────
export async function callLLM(opts: CallLLMOptions): Promise<LLMResult> {
  const {
    systemPrompt: rawSystem,
    userPrompt,
    modelGroup = "llama",
    useFastModel = false,
    requireJSON = false,
    maxTokens = 1024,
    temperature = 0.7,
    callerName = "unknown",
  } = opts;

  const budget = getBudgetStatus();
  if (budget.overWarning) {
    showToast(
      `AI budget at ${Math.round(budget.pct * 100)}% ($${budget.spend.toFixed(2)}/$${budget.limit.toFixed(2)})`,
      "warning"
    );
  }

  let systemPrompt = rawSystem;
  if (requireJSON) {
    systemPrompt +=
      "\n\nCRITICAL: Your entire response must be valid JSON only. No markdown fences, no explanation text, no preamble. Start your response with { and end with }.";
  }

  // Route to primary provider by group, then fall through to Gemini
  if (modelGroup === "mistral" && AI_CONFIG.mistral.apiKey && AI_CONFIG.mistral.apiKey !== "your_mistral_api_key_here") {
    try {
      return await callMistral({ systemPrompt, userPrompt, maxTokens, temperature, requireJSON, callerName });
    } catch (err: any) {
      console.warn(`[${callerName}] Mistral failed: ${err.message}. Falling back to Gemini.`);
    }
  } else if (modelGroup === "llama" && AI_CONFIG.groq.apiKey) {
    const model = useFastModel ? AI_CONFIG.groq.fastModel : AI_CONFIG.groq.primaryModel;
    try {
      return await callGroq({ systemPrompt, userPrompt, model, maxTokens, temperature, requireJSON, callerName });
    } catch (err: any) {
      console.warn(`[${callerName}] Groq/Llama failed: ${err.message}. Falling back to Gemini.`);
    }
  }

  // Gemini fallback
  if (AI_CONFIG.gemini.apiKey) {
    try {
      return await callGemini({ systemPrompt, userPrompt, maxTokens, requireJSON, callerName, modelGroup });
    } catch (geminiErr: any) {
      console.error(`[${callerName}] Gemini fallback also failed: ${geminiErr.message}`);
    }
  }

  throw new Error("ALL_PROVIDERS_FAILED");
}

// ── Groq (OpenAI-compatible) ──────────────────────────────────
async function callGroq(opts: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  requireJSON: boolean;
  callerName: string;
}): Promise<LLMResult> {
  const { systemPrompt, userPrompt, model, maxTokens, temperature, requireJSON, callerName } = opts;

  const response = await fetch(`${AI_CONFIG.groq.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.groq.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

  let content: string | Record<string, any> = rawContent;
  if (requireJSON) {
    const parsed = parseJSONSafely(rawContent, callerName);
    if (!parsed) throw new Error("JSON_PARSE_FAILED");
    content = parsed;
  }

  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  const costPer = AI_CONFIG.costPer1kTokens[model] || { input: 0.001, output: 0.001 };
  const cost =
    (usage.prompt_tokens / 1000) * costPer.input +
    (usage.completion_tokens / 1000) * costPer.output;

  recordAICost(cost, model, "llama", callerName, usage.prompt_tokens, usage.completion_tokens);
  return { content, cost, model, modelGroup: "llama", promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens };
}

// ── Mistral ───────────────────────────────────────────────────
async function callMistral(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  requireJSON: boolean;
  callerName: string;
}): Promise<LLMResult> {
  const { systemPrompt, userPrompt, maxTokens, temperature, requireJSON, callerName } = opts;
  const model = AI_CONFIG.mistral.primaryModel;

  const body: Record<string, any> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };
  if (requireJSON) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${AI_CONFIG.mistral.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.mistral.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Mistral HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

  let content: string | Record<string, any> = rawContent;
  if (requireJSON) {
    const parsed = parseJSONSafely(rawContent, callerName);
    if (!parsed) throw new Error("MISTRAL_JSON_PARSE_FAILED");
    content = parsed;
  }

  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  const costPer = AI_CONFIG.costPer1kTokens[model] || { input: 0.003, output: 0.009 };
  const cost =
    (usage.prompt_tokens / 1000) * costPer.input +
    (usage.completion_tokens / 1000) * costPer.output;

  recordAICost(cost, model, "mistral", callerName, usage.prompt_tokens, usage.completion_tokens);
  return { content, cost, model, modelGroup: "mistral", promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens };
}

// ── Gemini fallback ───────────────────────────────────────────
async function callGemini(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  requireJSON: boolean;
  callerName: string;
  modelGroup: ModelGroup;
}): Promise<LLMResult> {
  const { systemPrompt, userPrompt, maxTokens, requireJSON, callerName, modelGroup } = opts;
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  const url = `${AI_CONFIG.gemini.baseURL}/${AI_CONFIG.gemini.model}:generateContent?key=${AI_CONFIG.gemini.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combinedPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  let content: string | Record<string, any> = rawContent;
  if (requireJSON) {
    const parsed = parseJSONSafely(rawContent, callerName);
    if (!parsed) throw new Error("GEMINI_JSON_PARSE_FAILED");
    content = parsed;
  }

  const usage = data.usageMetadata || {};
  const promptTokens = usage.promptTokenCount || 0;
  const completionTokens = usage.candidatesTokenCount || 0;
  const costPer = AI_CONFIG.costPer1kTokens["gemini-1.5-flash"];
  const cost = (promptTokens / 1000) * costPer.input + (completionTokens / 1000) * costPer.output;

  recordAICost(cost, "gemini-1.5-flash", `${modelGroup}-fallback`, callerName, promptTokens, completionTokens);
  return { content, cost, model: "gemini-1.5-flash", modelGroup, promptTokens, completionTokens };
}

// ── JSON parser with fallback strategies ──────────────────────
function parseJSONSafely(raw: string, callerName: string): Record<string, any> | null {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* continue */ } }
  console.error(`[${callerName}] Could not parse JSON from LLM response:`, raw.slice(0, 200));
  return null;
}
