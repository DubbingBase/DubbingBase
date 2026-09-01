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
    "groq/compound"
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

interface LlmExecution<T> {
  name: string;
  fn: () => Promise<T>;
}

interface LlmResult<T> {
  data: T;
  model: string;
}

async function runWithFallbacks<T>(
  executions: LlmExecution<T>[],
): Promise<LlmResult<T>> {
  const failures: { name: string; msg: string }[] = [];
  for (const exec of executions) {
    try {
      const data = await exec.fn();
      return { data, model: exec.name };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[LLM] ${exec.name} failed: ${msg}`);
      failures.push({ name: exec.name, msg });
    }
  }
  const isRateLimit = failures.some(({ msg }) =>
    isRateLimitError({ message: msg } as Error),
  );
  const prefix = isRateLimit
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
): Promise<{ text: string; model: string }> {
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
      }).then((r) => r.text),
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
        }).then((r) => r.text),
    }),
  );

  const chain: LlmExecution<string>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return { text: result.data, model: result.model };
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
): Promise<{ data: z.infer<T>; model: string }> {
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
      }).then((r) => r.object),
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
        }).then((r) => r.object),
    }),
  );

  const chain: LlmExecution<z.infer<T>>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return { data: result.data, model: result.model };
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
): Promise<{ text: string; model: string }> {
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
      }).then((r) => r.text),
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
        }).then((r) => r.text),
    }),
  );

  const chain: LlmExecution<string>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return { text: result.data, model: result.model };
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
): Promise<{ data: z.infer<T>; model: string }> {
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
      }).then((r) => r.object),
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
        }).then((r) => r.object),
    }),
  );

  const chain: LlmExecution<z.infer<T>>[] =
    provider === "groq"
      ? [groqExec, ...geminiExecs]
      : [...geminiExecs, groqExec];

  const result = await runWithFallbacks(chain);
  return { data: result.data, model: result.model };
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
