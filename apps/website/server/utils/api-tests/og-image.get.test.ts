import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
  type EventHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import cacheHeadersMiddleware from "../../middleware/00-cache-headers";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
} from "../cache/http";

const routeMocks = vi.hoisted(() => ({
  useRuntimeConfig: vi.fn(),
  useStorage: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  fetch: vi.fn(),
  satori: vi.fn<(...args: unknown[]) => Promise<string>>(),
  satoriModuleLoads: vi.fn(),
  fallbackSatoriModuleLoads: vi.fn(),
  resvgModuleLoads: vi.fn(),
  resvgAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  render: vi.fn(),
}));

vi.mock("nitropack/runtime/internal/storage", () => ({
  useStorage: routeMocks.useStorage,
}));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

vi.mock("@cf-wasm/satori/workerd", () => {
  routeMocks.satoriModuleLoads();
  return { default: routeMocks.satori };
});

vi.mock("satori", () => {
  routeMocks.fallbackSatoriModuleLoads();
  return { default: routeMocks.satori };
});

let handler: EventHandler;

beforeAll(() => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("useRuntimeConfig", routeMocks.useRuntimeConfig);
  vi.stubGlobal("useStorage", routeMocks.useStorage);
  vi.stubGlobal("useSupabaseAdmin", routeMocks.useSupabaseAdmin);
  vi.stubGlobal("fetch", routeMocks.fetch);
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.doMock("@cf-wasm/resvg/workerd", () => {
    routeMocks.resvgModuleLoads();
    return { Resvg: { async: routeMocks.resvgAsync } };
  });

  routeMocks.useRuntimeConfig.mockReturnValue({
    public: { ogImagesEnabled: false, supabaseUrl: "https://db.example" },
    supabaseUrl: "https://db.example",
  });
  routeMocks.useStorage.mockReturnValue({
    getItemRaw: vi.fn().mockResolvedValue(new Uint8Array([1])),
  });
  routeMocks.satori.mockResolvedValue("<svg />");
  routeMocks.render.mockReturnValue({
    asPng: vi.fn(() => new Uint8Array([137, 80, 78, 71])),
  });
  routeMocks.resvgAsync.mockResolvedValue({ render: routeMocks.render });
  routeMocks.fetch.mockResolvedValue(
    new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/jpeg" },
    }),
  );

  handler = (await import("../../api/og-image/index.get")).default;
});

afterAll(() => vi.unstubAllGlobals());

async function request(path: string): Promise<Response> {
  const app = createApp();
  app.use("/", cacheHeadersMiddleware);
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.nitro = {
        runtimeConfig: routeMocks.useRuntimeConfig(),
      };
      return handler(event);
    }),
  );
  return toWebHandler(app)(new Request(`http://localhost${path}`));
}

function configureActor(profilePicture: string | null = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 42,
        firstname: "Ada",
        lastname: "Voice",
        voice_actor_name: null,
        profile_picture: profilePicture,
        nationality: "French",
        work: [{ id: 123 }],
      },
      error: null,
    }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  routeMocks.useSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => query),
  });
  return query;
}

function expectNoStore(response: Response): void {
  expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
  expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("expires")).toBe("0");
}

function expectPublic(response: Response, profile: "og-image" | "og-image-redirect"): void {
  expect(response.headers.get("cache-control")).toBe(getPublicCacheControl(profile));
  expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
    getCloudflareCacheControl(profile),
  );
  expect(response.headers.has("pragma")).toBe(false);
  expect(response.headers.has("expires")).toBe(false);
}

describe("GET /api/og-image", () => {
  it("redirects disabled image requests before any rendering or upstream work", async () => {
    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/android-chrome-512x512.png");
    expectPublic(response, "og-image-redirect");
    expect(routeMocks.useStorage).not.toHaveBeenCalled();
    expect(routeMocks.satoriModuleLoads).not.toHaveBeenCalled();
    expect(routeMocks.fallbackSatoriModuleLoads).not.toHaveBeenCalled();
    expect(routeMocks.resvgModuleLoads).not.toHaveBeenCalled();
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
    expect(routeMocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["missing type", "/?id=42"],
    ["unsupported type", "/?type=movie&id=42"],
    ["missing id", "/?type=voice-actor"],
    ["malformed id", "/?type=voice-actor&id=4abc"],
    ["zero id", "/?type=voice-actor&id=0"],
    ["unsafe id", "/?type=voice-actor&id=9007199254740992"],
  ])("keeps %s requests malformed and no-store", async (_label, path) => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: "true", supabaseUrl: "https://db.example" },
      supabaseUrl: "https://db.example",
    });
    const response = await request(path);

    expect(response.status).toBe(400);
    expectNoStore(response);
    expect(routeMocks.useStorage).not.toHaveBeenCalled();
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns a rendered PNG with one-hour browser and one-day edge caching when enabled", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: "true", supabaseUrl: "https://db.example" },
      supabaseUrl: "https://db.example",
    });
    configureActor();

    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expectPublic(response, "og-image");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([137, 80, 78, 71]);
    expect(routeMocks.satori).toHaveBeenCalledTimes(1);
    expect(routeMocks.resvgAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps unknown actors no-store", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: "true", supabaseUrl: "https://db.example" },
      supabaseUrl: "https://db.example",
    });
    const query = configureActor();
    query.single.mockResolvedValue({ data: null, error: { message: "missing" } });

    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(404);
    expectNoStore(response);
    expect(routeMocks.satori).not.toHaveBeenCalled();
  });

  it("keeps avatar-fetch fallbacks no-store", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: "true", supabaseUrl: "https://db.example" },
      supabaseUrl: "https://db.example",
    });
    configureActor("https://cdn.example/avatar.png");
    routeMocks.fetch.mockRejectedValue(new Error("avatar unavailable"));

    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(routeMocks.satori).toHaveBeenCalledTimes(1);
  });

  it("keeps rendering failures no-store", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: "true", supabaseUrl: "https://db.example" },
      supabaseUrl: "https://db.example",
    });
    configureActor();
    routeMocks.satori.mockRejectedValue(new Error("render failed"));

    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(500);
    expectNoStore(response);
  });

  it("rejects empty rendering output without caching it", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: true },
    });
    configureActor();
    routeMocks.render.mockReturnValue({
      asPng: vi.fn(() => new Uint8Array()),
    });

    const response = await request("/?type=voice-actor&id=42");

    expect(response.status).toBe(500);
    expectNoStore(response);
  });

  it("keeps dependency initialization fallbacks no-store on repeated requests", async () => {
    routeMocks.useRuntimeConfig.mockReturnValue({
      public: { ogImagesEnabled: true },
    });
    configureActor();
    vi.doMock("@cf-wasm/resvg/workerd", () => {
      throw new Error("renderer unavailable");
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request("/?type=voice-actor&id=42");

      expect(response.status).toBe(500);
      expectNoStore(response);
    }
    expect(routeMocks.fallbackSatoriModuleLoads).toHaveBeenCalledTimes(1);
  });
});
