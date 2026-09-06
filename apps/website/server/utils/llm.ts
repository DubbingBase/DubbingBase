import { generateText, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

function getLlmProvider(): "groq" | "gemini" {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  const provider = (
    (config.llmProvider as string) ||
    globalEnv?.NUXT_LLM_PROVIDER ||
    globalEnv?.LLM_PROVIDER ||
    process.env.NUXT_LLM_PROVIDER ||
    process.env.LLM_PROVIDER ||
    "gemini"
  ).toLowerCase();
  return provider === "groq" ? "groq" : "gemini";
}

function getGroqModel(): string {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  return (
    (config.groqModel as string) ||
    globalEnv?.NUXT_GROQ_MODEL ||
    globalEnv?.GROQ_MODEL ||
    process.env.NUXT_GROQ_MODEL ||
    process.env.GROQ_MODEL ||
    "llama-3.3-70b-versatile"
  );
}

function getGeminiModelChain(): string[] {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  const list =
    (config.geminiModels as string) ||
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

function getGoogleClient() {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  const apiKey =
    (config.googleAiKey as string) ||
    globalEnv?.NUXT_GOOGLE_AI_KEY ||
    globalEnv?.GOOGLE_AI_KEY ||
    globalEnv?.GEMINI_API_KEY ||
    process.env.NUXT_GOOGLE_AI_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_API_KEY ||
    "";
  if (!apiKey)
    throw new Error(
      "Google AI / Gemini API key is not configured (NUXT_GOOGLE_AI_KEY)",
    );
  return createGoogleGenerativeAI({ apiKey });
}

function getGroqClient() {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  const apiKey =
    (config.groqApiKey as string) ||
    globalEnv?.NUXT_GROQ_API_KEY ||
    globalEnv?.GROQ_API_KEY ||
    process.env.NUXT_GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    "";
  if (!apiKey)
    throw new Error("Groq API key is not configured (NUXT_GROQ_API_KEY)");
  return createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
    compatibility: "compatible",
  });
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
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
  const h = normalizeHeaders(headers as any);
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

function updateQuotaCache(
  model: string,
  headers?: Record<string, string> | Headers | null,
) {
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
  const chain = [...getGeminiModelChain(), getGroqModel()];
  let hasFreshCached = false;
  for (const m of chain) {
    const keys = [m, `Gemini (${m})`, `Groq (${m})`];
    for (const k of keys) {
      if (quotaRemainingCache.has(k)) {
        if (isQuotaCacheStale(k)) continue;
        hasFreshCached = true;
        if ((quotaRemainingCache.get(k) ?? 1) > 0) return false;
        break; // this model is 0, check next model
      }
    }
    // if no fresh cache for this model, we don't know — assume not exhausted
    if (
      !keys.some((k) => quotaRemainingCache.has(k) && !isQuotaCacheStale(k))
    ) {
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
  const h = normalizeHeaders(headers as any);
  if (!h) return undefined;
  const remReq =
    h["x-ratelimit-remaining-requests"] ??
    h["x-ratelimit-remaining"] ??
    h["ratelimit-remaining"];
  const limitReq =
    h["x-ratelimit-limit-requests"] ??
    h["x-ratelimit-limit"] ??
    h["ratelimit-limit"];
  const remTok = h["x-ratelimit-remaining-tokens"];
  const limitTok = h["x-ratelimit-limit-tokens"];
  const retryAfter = h["retry-after"];
  // Groq / OpenAI compatible: prefer requests quota (daily)
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

async function runWithFallbacks<T>(
  executions: LlmExecution<T>[],
): Promise<LlmResult<T>> {
  // pre-check: if we know all quotas are 0, fail fast without consuming queue element time
  if (areAllLlmQuotasExhausted()) {
    throw new Error(
      "LLM API Rate Limited (429) - all models quota exhausted (cached 0 remaining)",
    );
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
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[LLM] ${exec.name} failed: ${msg}`);
      // cache 0 remaining if rate limited, so next call skips this model
      if (isRateLimitError(error))
        updateQuotaCache(exec.name, {
          "x-ratelimit-remaining-requests": "0",
        } as any);
      failures.push({ name: exec.name, msg });
    }
  }
  const isRateLimit =
    failures.length > 0 &&
    failures.every(({ msg }) => isRateLimitError({ message: msg } as Error));
  // also treat as rate limit if any failure was rate limit and we exhausted all models
  const anyRateLimit = failures.some(({ msg }) =>
    isRateLimitError({ message: msg } as Error),
  );
  const finalIsRateLimit =
    isRateLimit || (anyRateLimit && failures.length === executions.length);
  const prefix = finalIsRateLimit
    ? "LLM API Rate Limited (429) - "
    : "All LLM fallbacks failed - ";
  const detail = failures
    .map(({ name, msg }) => `* ${name}: ${msg}`)
    .join(" | ");
  throw new Error(`${prefix}${detail}`);
}

function buildGeminiCalls<T>(
  models: string[],
  build: (model: string) => LlmExecution<T>,
): LlmExecution<T>[] {
  return models.map(build);
}

/**
 * Send a text prompt to an LLM and return the raw text response.
 * Tries all Gemini free-tier models in order (3.5-flash-lite → 2.5-flash → 2.0-flash → 1.5-flash),
 * then falls back to Groq. Configure via GEMINI_MODELS env var (comma-separated).
 */
export async function llmGenerate(
  prompt: string,
  options?: {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  },
): Promise<{
  text: string;
  model: string;
  usage?: LlmUsage;
  quota?: string;
  headers?: Record<string, string>;
}> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const groqModel = getGroqModel();

  const geminiModels = options?.model ? [options.model] : getGeminiModelChain();
  const groqExec: LlmExecution<string> = {
    name: `Groq (${groqModel})`,
    fn: () =>
      generateText({
        model: getGroqClient()(groqModel),
        prompt,
        system,
        temperature,
      }).then((r) => ({
        data: r.text,
        usage: (r as any).usage as LlmUsage | undefined,
        headers: (r as any).response?.headers as
          Record<string, string> | undefined,
      })),
  };

  const geminiExecs: LlmExecution<string>[] = buildGeminiCalls(
    geminiModels,
    (model) => ({
      name: `Gemini (${model})`,
      fn: () =>
        generateText({
          model: getGoogleClient()(model),
          prompt,
          system,
          temperature,
        }).then((r) => ({
          data: r.text,
          usage: (r as any).usage as LlmUsage | undefined,
          headers: (r as any).response?.headers as
            Record<string, string> | undefined,
        })),
    }),
  );

  const chain: LlmExecution<string>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return {
    text: result.data,
    model: result.model,
    usage: result.usage,
    quota: result.quota,
    headers: result.headers,
  };
}

/**
 * Send a text prompt to an LLM and return a typed JSON object validated by a Zod schema.
 * Tries all Gemini free-tier models in order, then falls back to Groq.
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
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const groqModel = getGroqModel();

  const geminiModels = options?.model ? [options.model] : getGeminiModelChain();
  const groqExec: LlmExecution<z.infer<T>> = {
    name: `Groq (${groqModel})`,
    fn: () =>
      generateObject({
        model: getGroqClient()(groqModel),
        prompt,
        schema,
        system,
        temperature,
      }).then((r) => ({
        data: r.object,
        usage: (r as any).usage as LlmUsage | undefined,
        headers: (r as any).response?.headers as
          Record<string, string> | undefined,
      })),
  };

  const geminiExecs: LlmExecution<z.infer<T>>[] = buildGeminiCalls(
    geminiModels,
    (model) => ({
      name: `Gemini (${model})`,
      fn: () =>
        generateObject({
          model: getGoogleClient()(model),
          prompt,
          schema,
          system,
          temperature,
        }).then((r) => ({
          data: r.object,
          usage: (r as any).usage as LlmUsage | undefined,
          headers: (r as any).response?.headers as
            Record<string, string> | undefined,
        })),
    }),
  );

  const chain: LlmExecution<z.infer<T>>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return {
    data: result.data,
    model: result.model,
    usage: result.usage,
    quota: result.quota,
    headers: result.headers,
  };
}

/**
 * Send a text prompt with an image to an LLM (vision) and return raw text.
 * Accepts a data URL ("data:image/jpeg;base64,...") or raw base64 with mimeType.
 * Uses Gemini by default, falls back to Groq on failure.
 */
export async function llmVision(
  prompt: string,
  imageData: string,
  mimeType: string = "image/jpeg",
  options?: {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  },
): Promise<{
  text: string;
  model: string;
  usage?: LlmUsage;
  quota?: string;
  headers?: Record<string, string>;
}> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const groqModel = getGroqModel();
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  const geminiModels = options?.model ? [options.model] : getGeminiModelChain();
  const groqExec: LlmExecution<string> = {
    name: `Groq (${groqModel})`,
    fn: () =>
      generateText({
        model: getGroqClient()(groqModel),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        system,
        temperature,
      }).then((r) => ({
        data: r.text,
        usage: (r as any).usage as LlmUsage | undefined,
        headers: (r as any).response?.headers as
          Record<string, string> | undefined,
      })),
  };

  const geminiExecs: LlmExecution<string>[] = buildGeminiCalls(
    geminiModels,
    (model) => ({
      name: `Gemini (${model})`,
      fn: () =>
        generateText({
          model: getGoogleClient()(model),
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, imageContent],
            },
          ],
          system,
          temperature,
        }).then((r) => ({
          data: r.text,
          usage: (r as any).usage as LlmUsage | undefined,
          headers: (r as any).response?.headers as
            Record<string, string> | undefined,
        })),
    }),
  );

  const chain: LlmExecution<string>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return {
    text: result.data,
    model: result.model,
    usage: result.usage,
    quota: result.quota,
    headers: result.headers,
  };
}

/**
 * Send a text prompt with an image to an LLM (vision) and return a typed JSON object.
 * Uses Gemini by default, falls back to Groq on failure.
 */
export async function llmVisionObject<T extends z.ZodType>(
  prompt: string,
  imageData: string,
  schema: T,
  mimeType: string = "image/jpeg",
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
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const groqModel = getGroqModel();
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  const geminiModels = options?.model ? [options.model] : getGeminiModelChain();
  const groqExec: LlmExecution<z.infer<T>> = {
    name: `Groq (${groqModel})`,
    fn: () =>
      generateObject({
        model: getGroqClient()(groqModel),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        schema,
        system,
        temperature,
      }).then((r) => ({
        data: r.object,
        usage: (r as any).usage as LlmUsage | undefined,
        headers: (r as any).response?.headers as
          Record<string, string> | undefined,
      })),
  };

  const geminiExecs: LlmExecution<z.infer<T>>[] = buildGeminiCalls(
    geminiModels,
    (model) => ({
      name: `Gemini (${model})`,
      fn: () =>
        generateObject({
          model: getGoogleClient()(model),
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, imageContent],
            },
          ],
          schema,
          system,
          temperature,
        }).then((r) => ({
          data: r.object,
          usage: (r as any).usage as LlmUsage | undefined,
          headers: (r as any).response?.headers as
            Record<string, string> | undefined,
        })),
    }),
  );

  const chain: LlmExecution<z.infer<T>>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return {
    data: result.data,
    model: result.model,
    usage: result.usage,
    quota: result.quota,
    headers: result.headers,
  };
}

function parseImageData(imageData: string, mimeType: string) {
  let rawBase64 = imageData;
  let resolvedMime = mimeType;
  if (imageData.startsWith("data:")) {
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (match?.[1] && match[2]) {
      resolvedMime = match[1];
      rawBase64 = match[2];
    }
  }
  return { rawBase64, resolvedMime };
}
