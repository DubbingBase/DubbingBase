import { createApp, defineEventHandler, toWebHandler, type EventHandler } from "h3";
import { beforeAll, describe, expect, it } from "vitest";
import cacheHeadersMiddleware from "../../middleware/00-cache-headers";
import { NO_STORE_CACHE_CONTROL } from "../cache/http";

let aboutPreferenceHandler: EventHandler;

beforeAll(async () => {
  aboutPreferenceHandler = (await import("../../api/about-preference.get")).default;
});

async function request(path: string): Promise<Response> {
  const app = createApp();
  app.use("/", cacheHeadersMiddleware);
  app.use(
    "/",
    defineEventHandler((event) => aboutPreferenceHandler(event)),
  );
  return toWebHandler(app)(new Request(`http://localhost${path}`));
}

describe("About preference fallback", () => {
  it("stores a language choice and redirects to its static page", async () => {
    const response = await request("/api/about-preference?locale=fr&lang=ja");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ja/about");
    expect(response.headers.get("set-cookie")).toContain("user_lang=ja");
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
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
