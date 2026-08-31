import { generateText, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const GROQ_MODEL = "llama-3.3-70b-versatile";

function getGeminiModel(): string {
  const config = useRuntimeConfig();
  return (
    (config.geminiModel as string) ||
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
  });
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("ResourceExhausted")
  );
}

async function runWithFallback<T>(
  fn: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      "[LLM] Primary LLM failed, falling back to Groq Llama 3.3 70B...",
      error instanceof Error ? error.message : error,
    );
    try {
      return await fallback();
    } catch (fallbackError) {
      if (isRateLimitError(fallbackError) || isRateLimitError(error)) {
        throw new Error("LLM API Rate Limited (429)");
      }
      const primaryMsg = error instanceof Error ? error.message : String(error);
      const fallbackMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      throw new Error(
        `LLM Failure - Primary (Gemini): ${primaryMsg} | Fallback (Groq): ${fallbackMsg}`,
      );
    }
  }
}

/**
 * Send a text prompt to an LLM and return the raw text response.
 * Tries Gemini first, falls back to Groq on rate limits.
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

  return runWithFallback(
    () =>
      generateText({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        prompt,
        system,
        temperature,
      }).then((r) => r.text),
    () =>
      generateText({
        model: getGroqClient()(GROQ_MODEL),
        prompt,
        system,
        temperature,
      }).then((r) => r.text),
  );
}

/**
 * Send a text prompt to an LLM and return a typed JSON object validated by a Zod schema.
 * Tries Gemini first, falls back to Groq on rate limits.
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

  return runWithFallback(
    () =>
      generateObject({
        model: getGoogleClient()(options?.model ?? getGeminiModel()),
        prompt,
        schema,
        system,
        temperature,
      }).then((r) => r.object),
    () =>
      generateObject({
        model: getGroqClient()(GROQ_MODEL),
        prompt,
        schema,
        system,
        temperature,
      }).then((r) => r.object),
  );
}

/**
 * Send a text prompt with an image to an LLM (vision) and return raw text.
 * Accepts a data URL ("data:image/jpeg;base64,...") or raw base64 with mimeType.
 * Tries Gemini first, falls back to Groq on rate limits.
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
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  return runWithFallback(
    () =>
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
    () =>
      generateText({
        model: getGroqClient()(GROQ_MODEL),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, imageContent],
          },
        ],
        system,
        temperature,
      }).then((r) => r.text),
  );
}

/**
 * Send a text prompt with an image to an LLM (vision) and return a typed JSON object.
 * Tries Gemini first, falls back to Groq on rate limits.
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
  const { rawBase64, resolvedMime } = parseImageData(imageData, mimeType);

  const imageContent = {
    type: "image" as const,
    image: `data:${resolvedMime};base64,${rawBase64}`,
  };

  return runWithFallback(
    () =>
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
    () =>
      generateObject({
        model: getGroqClient()(GROQ_MODEL),
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
  );
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
