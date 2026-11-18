import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({ name: z.string(), role: z.string().nullable() })),
});

function geminiResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("llmGenerateObject", () => {
  const fetchMock = vi.fn<typeof fetch>();

  let llmGenerateObject: typeof import("./llm").llmGenerateObject;
  let areAllLlmQuotasExhausted: typeof import("./llm").areAllLlmQuotasExhausted;

  beforeAll(async () => {
    // getGoogleApiKey / getGeminiModelChain read runtime config first, so set it there
    // rather than relying on the environment.
    Object.assign(useRuntimeConfig(), { googleAiKey: "test-key", geminiModels: "m1,m2" });
    vi.stubGlobal("fetch", fetchMock);
    ({ llmGenerateObject, areAllLlmQuotasExhausted } = await import("./llm"));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => fetchMock.mockReset());

  it("sends a structured-output request and validates the JSON answer", async () => {
    fetchMock.mockResolvedValueOnce(
      geminiResponse({
        candidates: [{ content: { parts: [{ text: '{"items":[{"name":"A","role":null}]}' }] } }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5, totalTokenCount: 8 },
      }),
    );

    const result = await llmGenerateObject("prompt", schema, {
      systemInstruction: "system",
      temperature: 0,
    });

    expect(result.data).toEqual({ items: [{ name: "A", role: null }] });
    expect(result.model).toBe("Gemini (m1)");
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 5, totalTokens: 8 });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent",
    );
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-key");
    const body = JSON.parse(String(init?.body));
    expect(body.systemInstruction.parts[0].text).toBe("system");
    expect(body.contents[0].parts[0].text).toBe("prompt");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.type).toBe("object");
    expect(body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
  });

  it("falls back to the next model and caches an exhausted quota", async () => {
    fetchMock
      .mockResolvedValueOnce(
        geminiResponse({ error: { message: "quota exceeded" } }, { status: 429 }),
      )
      .mockResolvedValueOnce(
        geminiResponse({
          candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }],
        }),
      );

    const result = await llmGenerateObject("prompt", schema);

    expect(result.model).toBe("Gemini (m2)");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(areAllLlmQuotasExhausted()).toBe(false);

    // The 429 cached m1 as exhausted, so the next call skips it and goes straight to m2.
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      geminiResponse({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }),
    );
    await llmGenerateObject("prompt", schema);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/m2:generateContent");
  });

  it("rejects an answer that does not match the schema", async () => {
    fetchMock.mockResolvedValue(
      geminiResponse({ candidates: [{ content: { parts: [{ text: '{"items":"nope"}' }] } }] }),
    );

    await expect(llmGenerateObject("prompt", schema, { model: "m3" })).rejects.toThrow(
      /All LLM fallbacks failed/,
    );
  });
});
