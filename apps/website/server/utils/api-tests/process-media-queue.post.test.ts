import {
  createApp,
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  readBody,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requester = "11111111-1111-4111-8111-111111111111";

const routeMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendDiscordAdminNotification: vi.fn(),
  checkMediaDubbingSections: vi.fn(),
  checkGameDubbingSections: vi.fn(),
  extractMediaDubbingCredits: vi.fn(),
  extractGameDubbingCredits: vi.fn(),
  useWikipediaCache: vi.fn(),
  cacheGetOrFetch: vi.fn(),
}));

vi.mock("../notifications/discord", () => ({
  sendDiscordAdminNotification: routeMocks.sendDiscordAdminNotification,
}));
vi.mock("../services/media-preparation", () => ({
  checkMediaDubbingSections: routeMocks.checkMediaDubbingSections,
  checkGameDubbingSections: routeMocks.checkGameDubbingSections,
  extractMediaDubbingCredits: routeMocks.extractMediaDubbingCredits,
  extractGameDubbingCredits: routeMocks.extractGameDubbingCredits,
}));
vi.mock("../retryable-request", () => ({
  createMediaResponseError: vi.fn(),
  fetchMediaRequest: vi.fn(),
  isRetryableMediaRequestError: vi.fn(() => false),
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }) }));
vi.mock("../auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("..", () => ({
  useWikipediaCache: routeMocks.useWikipediaCache,
  useIgdbClient: vi.fn(),
  useCache: vi.fn(() => ({ getOrFetch: routeMocks.cacheGetOrFetch })),
}));
vi.mock("../llm", () => ({ areAllLlmQuotasExhausted: vi.fn(() => false) }));
vi.mock("../cache/http", () => ({ setNoStoreHeaders: vi.fn() }));

let handler: typeof import("../../api/process-media-queue.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("readBody", readBody);
  vi.stubGlobal("useRuntimeConfig", () => ({ supabaseSecretKey: "queue-secret" }));
  handler = (await import("../../api/process-media-queue.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.sendDiscordAdminNotification.mockResolvedValue(undefined);
  routeMocks.checkMediaDubbingSections.mockResolvedValue({
    ok: true,
    title: "Test movie",
    sectionIndexes: [2],
    pageId: 55,
    wikipediaUrl: "https://simple.wikipedia.org/wiki/Test_movie",
  });
  routeMocks.checkGameDubbingSections.mockResolvedValue({
    ok: true,
    title: "Test game",
    sectionIndexes: [2],
    pageId: 55,
    wikipediaUrl: "https://simple.wikipedia.org/wiki/Test_game",
  });
  routeMocks.extractMediaDubbingCredits.mockResolvedValue({
    ok: true,
    changes: 1,
    creditsAdded: 1,
  });
  routeMocks.extractGameDubbingCredits.mockResolvedValue({
    ok: true,
    changes: 1,
    creditsAdded: 1,
  });
  routeMocks.useWikipediaCache.mockReturnValue({
    getAllSitelinksEntity: vi.fn(async (wikiId: string) => ({
      entities: {
        [wikiId]: { sitelinks: { enwiki: { title: "Example" }, frwiki: { title: "Exemple" } } },
      },
    })),
  });
  routeMocks.rpc.mockImplementation(async (name: string) => {
    if (name === "pop_media_queue_batch") {
      return {
        data: [
          {
            msg_id: 17,
            read_ct: 1,
            message: {
              tmdb_id: 42,
              media_type: "movie",
              wiki_id: "Q42",
              wikipedia_language: "simple",
              dubbing_language: "en-US",
              is_manual: true,
            },
          },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  });
});

afterAll(() => vi.unstubAllGlobals());

async function processQueue(
  queue: "discovery" | "check" | "extract",
  payloadChanges: Record<string, unknown> = {},
) {
  routeMocks.rpc.mockImplementation(async (name: string) => {
    if (
      name === "pop_media_queue_batch" ||
      name === "pop_media_queue_message"
    ) {
      return {
        data: [
          {
            msg_id: 17,
            read_ct: 1,
            message: {
              tmdb_id: 42,
              media_type: "movie",
              wiki_id: "Q42",
              wikipedia_language: "simple",
              dubbing_language: "en-US",
              is_manual: true,
              ...(queue === "check" || queue === "extract"
                ? { page_id: 55, section_indexes: [2] }
                : {}),
              ...payloadChanges,
            },
          },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  });

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request(`http://localhost/?queue=${queue}`, {
      method: "POST",
      headers: {
        "x-internal-secret": "queue-secret",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
}

describe("POST /api/process-media-queue requester propagation", () => {
  it("does not invoke cache-backed work for an empty queue cycle", async () => {
    routeMocks.rpc.mockResolvedValue({ data: [], error: null });
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => handler(event)),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/?queue=check", {
        method: "POST",
        headers: {
          "x-internal-secret": "queue-secret",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );

    expect(await response.json()).toEqual(
      expect.objectContaining({ processed: 0, reason: "no_pending_items" }),
    );
    expect(routeMocks.cacheGetOrFetch).not.toHaveBeenCalled();
    expect(routeMocks.checkMediaDubbingSections).not.toHaveBeenCalled();
  });

  it("preserves requested_by through discovery fan-out into every wiki_check", async () => {
    await processQueue("discovery", { requested_by: requester });

    const childEnqueues = routeMocks.rpc.mock.calls.filter(
      ([name]) => name === "enqueue_media_fetch",
    );
    expect(childEnqueues.length).toBeGreaterThan(0);
    for (const [name, args] of childEnqueues) {
      expect(name).toBe("enqueue_media_fetch");
      expect(args).toEqual(expect.objectContaining({ p_requested_by: requester }));
    }
  });

  it("preserves requested_by from wiki_check into wiki_extract", async () => {
    await processQueue("check", { requested_by: requester });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({ p_requested_by: requester }),
    );
  });

  it.each([
    ["missing", {}],
    ["malformed", { requested_by: "not-a-uuid" }],
  ] as const)("does not invent a requester when the field is %s", async (_caseName, payload) => {
    await processQueue("check", payload);

    const enqueue = routeMocks.rpc.mock.calls.find(([name]) => name === "enqueue_media_extract");
    expect(enqueue).toBeDefined();
    expect(enqueue?.[1]).not.toHaveProperty("p_requested_by");
  });
});
