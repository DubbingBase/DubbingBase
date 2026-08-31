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
    "groq"
  ).toLowerCase();
  return provider === "gemini" ? "gemini" : "groq";
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
    "llama-3.1-8b-instant"
  );
}

function getGeminiModel(): string {
  const config = useRuntimeConfig();
  const globalEnv = (globalThis as any)?.__env__;
  return (
    (config.geminiModel as string) ||
    globalEnv?.NUXT_GEMINI_MODEL ||
    globalEnv?.GEMINI_MODEL ||
    process.env.NUXT_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash"
  );
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

interface LlmExecution<T> {
  name: string;
  fn: () => Promise<T>;
}

async function runWithFallback<T>(
  primary: LlmExecution<T>,
  fallback: LlmExecution<T>,
): Promise<T> {
  try {
    return await primary.fn();
  } catch (error) {
    console.warn(
      `[LLM] Primary LLM (${primary.name}) failed, falling back to ${fallback.name}...`,
      error instanceof Error ? error.message : error,
    );
    try {
      return await fallback.fn();
    } catch (fallbackError) {
      const primaryMsg = error instanceof Error ? error.message : String(error);
      const fallbackMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      const isRateLimit =
        isRateLimitError(fallbackError) || isRateLimitError(error);
      const rateLimitPrefix = isRateLimit
        ? "LLM API Rate Limited (429) - "
        : "";
      throw new Error(
        `${rateLimitPrefix}Primary (${primary.name}): ${primaryMsg} | Fallback (${fallback.name}): ${fallbackMsg}`,
      );
    }
  }
}

/**
 * Send a text prompt to an LLM and return the raw text response.
 * Uses Groq (llama-3.1-8b-instant) by default, falls back to Gemini (gemini-3.6-flash).
 */
export async function llmGenerate(
  prompt: string,
  options?: {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  },
): Promise<string> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();

  const groqCall: LlmExecution<string> = {
    name: `Groq (${options?.model ?? getGroqModel()})`,
    fn: () =>
      generateText({
        model: getGroqClient()(options?.model ?? getGroqModel()),
        prompt,
        system,
        temperature,
      }).then((r) => r.text),
  };

  const geminiCall: LlmExecution<string> = {
    name: `Gemini (${options?.model ?? getGeminiModel()})`,
    fn: () =>
      generateText({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        prompt,
        system,
        temperature,
      }).then((r) => r.text),
  };

  return provider === "groq"
    ? runWithFallback(groqCall, geminiCall)
    : runWithFallback(geminiCall, groqCall);
}

/**
 * Send a text prompt to an LLM and return a typed JSON object validated by a Zod schema.
 * Uses Groq (llama-3.1-8b-instant) by default, falls back to Gemini (gemini-3.6-flash).
 */
export async function llmGenerateObject<T extends z.ZodType>(
  prompt: string,
  schema: T,
  options?: {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  },
): Promise<z.infer<T>> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();

  const groqCall: LlmExecution<z.infer<T>> = {
    name: `Groq (${options?.model ?? getGroqModel()})`,
    fn: () =>
      generateObject({
        model: getGroqClient()(options?.model ?? getGroqModel()),
        prompt,
        schema,
        system,
        temperature,
      }).then((r) => r.object),
  };

  const geminiCall: LlmExecution<z.infer<T>> = {
    name: `Gemini (${options?.model ?? getGeminiModel()})`,
    fn: () =>
      generateObject({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        prompt,
        schema,
        system,
        temperature,
      }).then((r) => r.object),
  };

  return provider === "groq"
    ? runWithFallback(groqCall, geminiCall)
    : runWithFallback(geminiCall, groqCall);
}

/**
 * Send a text prompt with an image to an LLM (vision) and return raw text.
 * Accepts a data URL ("data:image/jpeg;base64,...") or raw base64 with mimeType.
 * Uses Groq by default, falls back to Gemini on failure.
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
): Promise<string> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  const groqCall: LlmExecution<string> = {
    name: `Groq (${options?.model ?? getGroqModel()})`,
    fn: () =>
      generateText({
        model: getGroqClient()(options?.model ?? getGroqModel()),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        system,
        temperature,
      }).then((r) => r.text),
  };

  const geminiCall: LlmExecution<string> = {
    name: `Gemini (${options?.model ?? getGeminiModel()})`,
    fn: () =>
      generateText({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        system,
        temperature,
      }).then((r) => r.text),
  };

  return provider === "groq"
    ? runWithFallback(groqCall, geminiCall)
    : runWithFallback(geminiCall, groqCall);
}

/**
 * Send a text prompt with an image to an LLM (vision) and return a typed JSON object.
 * Uses Groq by default, falls back to Gemini on failure.
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
): Promise<z.infer<T>> {
  const system = options?.systemInstruction;
  const temperature = options?.temperature;
  const provider = getLlmProvider();
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  const groqCall: LlmExecution<z.infer<T>> = {
    name: `Groq (${options?.model ?? getGroqModel()})`,
    fn: () =>
      generateObject({
        model: getGroqClient()(options?.model ?? getGroqModel()),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        schema,
        system,
        temperature,
      }).then((r) => r.object),
  };

  const geminiCall: LlmExecution<z.infer<T>> = {
    name: `Gemini (${options?.model ?? getGeminiModel()})`,
    fn: () =>
      generateObject({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        schema,
        system,
        temperature,
      }).then((r) => r.object),
  };

  return provider === "groq"
    ? runWithFallback(groqCall, geminiCall)
    : runWithFallback(geminiCall, groqCall);
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
