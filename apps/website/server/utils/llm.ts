import { getGlobalEnv } from "./global-env";
import { asString } from "./narrow";
import { z } from "zod";
import { isRecord, readPath } from "@app/shared-logic";
import { getErrorMessage } from "./error-message";

function getGeminiModelChain(): string[] {
  const config = useRuntimeConfig();
  const globalEnv = getGlobalEnv();
  const list =
    asString(config.geminiModels) ||
    globalEnv?.NUXT_GEMINI_MODELS ||
    globalEnv?.GEMINI_MODELS ||
    process.env.NUXT_GEMINI_MODELS ||
    process.env.GEMINI_MODELS;
  if (list) {
    return list
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean);
  }
  return ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
}

function getGoogleApiKey(): string {
  const config = useRuntimeConfig();
  const globalEnv = getGlobalEnv();
  const apiKey =
    asString(config.googleAiKey) ||
    globalEnv?.NUXT_GOOGLE_AI_KEY ||
    globalEnv?.GOOGLE_AI_KEY ||
    globalEnv?.GEMINI_API_KEY ||
    process.env.NUXT_GOOGLE_AI_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_API_KEY ||
    "";
  if (!apiKey) throw new Error("Google AI / Gemini API key is not configured (NUXT_GOOGLE_AI_KEY)");
  return apiKey;
}

function isRateLimitError(error: unknown): boolean {
  const msg = getErrorMessage(error);
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("ResourceExhausted") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

// ponytail: quota cache to avoid dequeuing when all models are exhausted
const quotaRemainingCache = new Map<string, number>();
const quotaCacheAt = new Map<string, number>();
const QUOTA_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function parseRemainingFromHeaders(
  headers?: Record<string, string> | Headers | null,
): number | undefined {
  const h = normalizeHeaders(headers);
  if (!h) return undefined;
  const rem =
    h["x-ratelimit-remaining-requests"] ??
    h["x-ratelimit-remaining"] ??
    h["ratelimit-remaining"] ??
    h["x-ratelimit-remaining-request"] ??
    h["x-ratelimit-remaining-tokens"];
  if (rem == null) return undefined;
  const n = Number(String(rem).trim());
  return Number.isFinite(n) ? n : undefined;
}

function updateQuotaCache(model: string, headers?: Record<string, string> | Headers | null) {
  const rem = parseRemainingFromHeaders(headers);
  if (rem != null) {
    quotaRemainingCache.set(model, rem);
    quotaCacheAt.set(model, Date.now());
  }
}

function isQuotaCacheStale(model: string): boolean {
  const at = quotaCacheAt.get(model);
  if (at == null) return true;
  return Date.now() - at > QUOTA_CACHE_TTL_MS;
}

export function areAllLlmQuotasExhausted(): boolean {
  // check all known models in chain; if we have no cache yet, assume not exhausted
  // stale entries (older than 1h) are ignored — allow retry after quota reset window
  const chain = getGeminiModelChain();
  let hasFreshCached = false;
  for (const m of chain) {
    const keys = [m, `Gemini (${m})`];
    for (const k of keys) {
      if (quotaRemainingCache.has(k)) {
        if (isQuotaCacheStale(k)) continue;
        hasFreshCached = true;
        if ((quotaRemainingCache.get(k) ?? 1) > 0) return false;
        break; // this model is 0, check next model
      }
    }
    // if no fresh cache for this model, we don't know — assume not exhausted
    if (!keys.some((k) => quotaRemainingCache.has(k) && !isQuotaCacheStale(k))) {
      return false;
    }
  }
  // if we have fresh cached values and all are 0, then exhausted
  return hasFreshCached;
}

export function getLlmQuotaCache() {
  return new Map(quotaRemainingCache);
}

interface LlmExecution<T> {
  name: string;
  fn: () => Promise<{
    data: T;
    usage?: LlmUsage;
    headers?: Record<string, string>;
  }>;
}

interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface LlmResult<T> {
  data: T;
  model: string;
  usage?: LlmUsage;
  quota?: string;
  headers?: Record<string, string>;
}

function normalizeHeaders(
  raw?: Record<string, string> | Headers | null,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (raw instanceof Headers) {
    const out: Record<string, string> = {};
    raw.forEach((v, k) => (out[k.toLowerCase()] = v));
    return out;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k.toLowerCase()] = String(v);
  return out;
}

function extractQuotaFromHeaders(
  headers?: Record<string, string> | Headers | null,
): string | undefined {
  const h = normalizeHeaders(headers);
  if (!h) return undefined;
  const remReq =
    h["x-ratelimit-remaining-requests"] ?? h["x-ratelimit-remaining"] ?? h["ratelimit-remaining"];
  const limitReq =
    h["x-ratelimit-limit-requests"] ?? h["x-ratelimit-limit"] ?? h["ratelimit-limit"];
  const remTok = h["x-ratelimit-remaining-tokens"];
  const limitTok = h["x-ratelimit-limit-tokens"];
  const retryAfter = h["retry-after"];
  // Prefer the requests quota (daily)
  if (remReq && limitReq) return `${remReq}/${limitReq} req remaining`;
  if (remReq) return `${remReq} req remaining`;
  if (remTok && limitTok) return `${remTok}/${limitTok} tokens remaining`;
  if (remTok) return `${remTok} tokens remaining`;
  if (limitReq) return `limit ${limitReq}`;
  if (retryAfter) return `retry-after ${retryAfter}s`;
  // Google / generic quota headers
  for (const [k, v] of Object.entries(h)) {
    if (k.includes("quota")) return `${k}: ${v}`;
  }
  for (const [k, v] of Object.entries(h)) {
    if (k.includes("ratelimit")) return `${k}: ${v}`;
  }
  return undefined;
}

async function runWithFallbacks<T>(executions: LlmExecution<T>[]): Promise<LlmResult<T>> {
  // pre-check: if we know all quotas are 0, fail fast without consuming queue element time
  if (areAllLlmQuotasExhausted()) {
    throw new Error("LLM API Rate Limited (429) - all models quota exhausted (cached 0 remaining)");
  }
  const failures: { name: string; msg: string }[] = [];
  for (const exec of executions) {
    // skip models we know are exhausted (0 remaining) to avoid wasted calls, unless cache stale
    const cached = quotaRemainingCache.get(exec.name);
    if (cached != null && cached <= 0 && !isQuotaCacheStale(exec.name)) {
      const msg = "quota exhausted (cached 0 remaining)";
      console.warn(`[LLM] ${exec.name} skipped: ${msg}`);
      failures.push({ name: exec.name, msg });
      continue;
    }
    try {
      const { data, usage, headers } = await exec.fn();
      const quota = extractQuotaFromHeaders(headers);
      updateQuotaCache(exec.name, headers);
      return { data, model: exec.name, usage, quota, headers };
    } catch (error) {
      const msg = getErrorMessage(error);
      console.warn(`[LLM] ${exec.name} failed: ${msg}`);
      // cache 0 remaining if rate limited, so next call skips this model
      if (isRateLimitError(error))
        updateQuotaCache(exec.name, {
          "x-ratelimit-remaining-requests": "0",
        });
      failures.push({ name: exec.name, msg });
    }
  }
  const isRateLimit =
    failures.length > 0 && failures.every(({ msg }) => isRateLimitError({ message: msg }));
  // also treat as rate limit if any failure was rate limit and we exhausted all models
  const anyRateLimit = failures.some(({ msg }) => isRateLimitError({ message: msg }));
  const finalIsRateLimit = isRateLimit || (anyRateLimit && failures.length === executions.length);
  const prefix = finalIsRateLimit ? "LLM API Rate Limited (429) - " : "All LLM fallbacks failed - ";
  const detail = failures.map(({ name, msg }) => `* ${name}: ${msg}`).join(" | ");
  throw new Error(`${prefix}${detail}`);
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function readTokenCount(usage: unknown, key: string): number | undefined {
  const value = readPath(usage, key);
  return typeof value === "number" ? value : undefined;
}

/**
 * Send a text prompt to Gemini and return a typed JSON object validated by a Zod schema.
 * Tries all Gemini free-tier models in order (configure via GEMINI_MODELS, comma-separated).
 *
 * Calls the Gemini REST API directly: the Vercel AI SDK (ai, @ai-sdk/google, gateway,
 * provider-utils) added about 385 KB to the Worker bundle for a single JSON request.
 */
export async function llmGenerateObject<T extends z.ZodType>(
  prompt: string,
  schema: T,
  options?: {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  },
): Promise<{
  data: z.infer<T>;
  model: string;
  usage?: LlmUsage;
  quota?: string;
  headers?: Record<string, string>;
}> {
  const { $schema: _ignored, ...responseJsonSchema } = z.toJSONSchema(schema);
  const geminiModels = options?.model ? [options.model] : getGeminiModelChain();
  const geminiExecs: LlmExecution<z.infer<T>>[] = geminiModels.map((model) => ({
    name: `Gemini (${model})`,
    fn: async () => {
      const response = await fetch(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": getGoogleApiKey() },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(options?.systemInstruction
              ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
              : {}),
            generationConfig: {
              temperature: options?.temperature,
              responseMimeType: "application/json",
              responseJsonSchema,
            },
          }),
        },
      );
      const headers = normalizeHeaders(response.headers);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = readPath(body, "error", "message");
        throw new Error(
          `${response.status} ${typeof detail === "string" ? detail : response.statusText}`,
        );
      }
      const parts = readPath(body, "candidates", "0", "content", "parts");
      const text = Array.isArray(parts)
        ? parts.map((part) => (isRecord(part) ? asString(part.text) : undefined) ?? "").join("")
        : "";
      if (!text) throw new Error("Gemini returned no content");
      const usage = readPath(body, "usageMetadata");
      return {
        data: schema.parse(JSON.parse(text)),
        usage: {
          inputTokens: readTokenCount(usage, "promptTokenCount"),
          outputTokens: readTokenCount(usage, "candidatesTokenCount"),
          totalTokens: readTokenCount(usage, "totalTokenCount"),
        },
        headers,
      };
    },
  }));

  const result = await runWithFallbacks(geminiExecs);
  return {
    data: result.data,
    model: result.model,
    usage: result.usage,
    quota: result.quota,
    headers: result.headers,
  };
}
