import { createEvent, isError, type EventHandler } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { beforeAll, describe, expect, it } from "vitest";
import cacheHeadersMiddleware from "../../middleware/00-cache-headers";
import { NO_STORE_CACHE_CONTROL } from "../cache/http";

let aboutPreferenceHandler: EventHandler;

interface TestResponse {
  status: number;
  headers: Headers;
}

beforeAll(async () => {
  aboutPreferenceHandler = (await import("../../api/about-preference.get")).default;
});

async function request(path: string, cookie?: string): Promise<TestResponse> {
  const nodeRequest = new IncomingMessage(new Socket());
  nodeRequest.method = "GET";
  nodeRequest.url = path;
  nodeRequest.headers.host = "localhost";
  if (cookie) nodeRequest.headers.cookie = cookie;

  const nodeResponse = new ServerResponse(nodeRequest);
  const event = createEvent(nodeRequest, nodeResponse);
  cacheHeadersMiddleware(event);

  try {
    await aboutPreferenceHandler(event);
  } catch (error) {
    if (!isError(error)) throw error;
    nodeResponse.statusCode = error.statusCode;
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeResponse.getHeaders())) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, String(item));
    } else {
      headers.set(name, String(value));
    }
  }

  return { status: nodeResponse.statusCode, headers };
}

describe("About preference fallback", () => {
  it("stores a language choice and redirects to its static page", async () => {
    const response = await request("/api/about-preference?locale=fr&lang=ja");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ja/about");
    expect(response.headers.get("set-cookie")).toContain("user_lang=ja");
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("preserves a saved light theme while changing language", async () => {
    const response = await request(
      "/api/about-preference?locale=fr&lang=ja",
      "dubbingbase-theme=light",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ja/about.light.html");
    expect(response.headers.get("set-cookie")).toContain("user_lang=ja");
  });

  it("stores a light theme and redirects to the static light page", async () => {
    const response = await request("/api/about-preference?locale=es&theme=light");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/es/about.light.html");
    expect(response.headers.get("set-cookie")).toContain("dubbingbase-theme=light");
  });

  it("rejects invalid preference values", async () => {
    const response = await request(
      "/api/about-preference?locale=https%3A%2F%2Fevil.example&lang=fr",
    );

    expect(response.status).toBe(400);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
});
