import { generateText, generateObject } from "npm:ai";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { z } from "npm:zod";

const GEMINI_MODEL = "gemini-3.5-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function getGoogleClient() {
  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_KEY is not set");
  return createGoogleGenerativeAI({ apiKey });
}

function getGroqClient() {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429") || msg.includes("rate") || msg.includes("quota");
}

async function runWithFallback<T>(
  fn: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn("[LLM] Primary rate limited, trying fallback...");
      try {
        return await fallback();
      } catch (fallbackError) {
        if (isRateLimitError(fallbackError)) {
          throw new Error("LLM API Rate Limited (429)");
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

/**
 * Send a text prompt to an LLM and return the raw text response.
 * Tries Gemini first, falls back to Groq on rate limits.
 */
export async function geminiGenerate(
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
        model: getGoogleClient()(options?.model ?? GEMINI_MODEL),
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
export async function geminiGenerateObject<T extends z.ZodType>(
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
        model: getGoogleClient()(options?.model ?? GEMINI_MODEL),
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
export async function geminiVision(
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
        model: getGoogleClient()(options?.model ?? GEMINI_MODEL),
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
export async function geminiVisionObject<T extends z.ZodType>(
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
        model: getGoogleClient()(options?.model ?? GEMINI_MODEL),
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
    if (match) {
      resolvedMime = match[1];
      rawBase64 = match[2];
    }
  }
  return { rawBase64, resolvedMime };
}
