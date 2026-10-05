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
  getPageSectionAsWikitext: vi.fn(),
  useIgdbClient: vi.fn(),
  getGame: vi.fn(),
  cacheGetOrFetch: vi.fn(),
  enqueueMediaExtractError: "",
  archiveQueueResult: vi.fn(
    (): {
      data: boolean | null;
      error: { message: string } | null;
    } => ({
      data: true,
      error: null,
    }),
  ),
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
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }),
}));
vi.mock("../auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("..", () => ({
  useWikipediaCache: routeMocks.useWikipediaCache,
  useIgdbClient: routeMocks.useIgdbClient,
  useCache: vi.fn(() => ({ getOrFetch: routeMocks.cacheGetOrFetch })),
}));
vi.mock("../llm", () => ({ areAllLlmQuotasExhausted: vi.fn(() => false) }));
let handler: typeof import("../../api/process-media-queue.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("readBody", readBody);
  vi.stubGlobal("useRuntimeConfig", () => ({
    supabaseSecretKey: "queue-secret",
  }));
  handler = (await import("../../api/process-media-queue.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.enqueueMediaExtractError = "";
  routeMocks.archiveQueueResult.mockReturnValue({ data: true, error: null });
  routeMocks.sendDiscordAdminNotification.mockResolvedValue(undefined);
  routeMocks.getPageSectionAsWikitext.mockResolvedValue({
    parse: { wikitext: "Original cast: actor names." },
  });
  routeMocks.checkMediaDubbingSections.mockResolvedValue({
    ok: true,
    title: "Test movie",
    sectionIndexes: [2],
    pageId: 55,
    wikipediaUrl: "https://en.wikipedia.org/wiki/Test_movie",
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
    getPageSectionAsWikitext: routeMocks.getPageSectionAsWikitext,
    searchWikidataEntities: vi.fn(async () => ({ search: [{ id: "Q42" }] })),
    getAllSitelinksEntity: vi.fn(async (wikiId: string) => ({
      entities: {
        [wikiId]: {
          sitelinks: {
            enwiki: { title: "Example" },
            frwiki: { title: "Exemple" },
          },
        },
      },
    })),
  });
  routeMocks.useIgdbClient.mockReturnValue({ getGame: routeMocks.getGame });
  routeMocks.getGame.mockResolvedValue({ name: "Test game" });
  routeMocks.rpc.mockImplementation(async (name: string) => {
    if (name === "enqueue_media_extract" && routeMocks.enqueueMediaExtractError) {
      return {
        data: null,
        error: { message: routeMocks.enqueueMediaExtractError },
      };
    }
    if (name === "archive_wiki_check_with_outcome") {
      return { data: true, error: null };
    }
    if (name === "archive_media_queue_message_with_error") return routeMocks.archiveQueueResult();
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
              wikipedia_language: "en",
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
    if (name === "enqueue_media_extract" && routeMocks.enqueueMediaExtractError) {
      return {
        data: null,
        error: { message: routeMocks.enqueueMediaExtractError },
      };
    }
    if (name === "archive_wiki_check_with_outcome") {
      return { data: true, error: null };
    }
    if (name === "archive_media_queue_message_with_error") return routeMocks.archiveQueueResult();
    if (name === "pop_media_queue_batch" || name === "pop_media_queue_message") {
      return {
        data: [
          {
            msg_id: 17,
            read_ct: 1,
            message: {
              tmdb_id: 42,
              media_type: "movie",
              wiki_id: "Q42",
              wikipedia_language: "en",
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

  it("uses the standard stable Wikidata metadata lookup in queue discovery", async () => {
    await processQueue("discovery");

    const wikipediaCache = routeMocks.useWikipediaCache.mock.results[0]?.value;
    expect(wikipediaCache.getAllSitelinksEntity).toHaveBeenCalledWith("Q42");
  });

  it("uses the standard stable IGDB metadata lookup in queue discovery", async () => {
    await processQueue("discovery", {
      media_type: "video_game",
      wiki_id: undefined,
    });

    expect(routeMocks.getGame).toHaveBeenCalledWith(42);
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
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "VF : Jean Dupont as Hero." },
    });
    await processQueue("check", {
      requested_by: requester,
      dubbing_language: undefined,
    });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({ p_requested_by: requester }),
    );
  });

  it("archives ordinary cast candidates with metadata and one terminal notification", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [2],
      sectionCandidates: [{ index: 2, heading: "Distribution", headingKind: "generic_cast" }],
      pageId: 55,
    });
    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_msg_id: 17,
        p_archive_reason: "no_dubbing_evidence",
        p_candidate_sections: [expect.objectContaining({ index: 2 })],
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("delay_media_queue_message", expect.anything());
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      "Wikipedia Check Archived — No Dubbing",
      expect.stringContaining("no_dubbing_evidence"),
      expect.anything(),
    );
  });

  it("keeps an explicit regional heading with a credit-shaped table", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [5],
      sectionCandidates: [
        {
          index: 5,
          heading: "Version française",
          headingKind: "explicit_dubbing",
        },
      ],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: {
        wikitext: '{| class="wikitable"\n| Character || Actor\n| Hero || Jean Dupont\n|}',
      },
    });

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [5],
      }),
    );
  });

  it("does not treat an original voice cast as dubbing evidence", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [6],
      sectionCandidates: [{ index: 6, heading: "Voice cast", headingKind: "explicit_dubbing" }],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "The original voice cast includes Ana and Luis." },
    });

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({ p_archive_reason: "no_dubbing_evidence" }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
  });

  it("routes generic game cast candidates through evidence classification", async () => {
    routeMocks.checkGameDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test game",
      sectionIndexes: [8],
      sectionCandidates: [{ index: 8, heading: "Cast", headingKind: "generic_cast" }],
      pageId: 55,
    });

    await processQueue("check", {
      media_type: "video_game",
      dubbing_language: undefined,
    });

    expect(routeMocks.checkGameDubbingSections).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 42 }),
    );
    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({ p_archive_reason: "no_dubbing_evidence" }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
  });

  it("archives an empty candidate result as no_candidate_sections", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [],
      sectionCandidates: [],
      pageId: 55,
      wikipediaUrl: "https://en.wikipedia.org/wiki/Test_movie",
    });

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({ p_archive_reason: "no_candidate_sections" }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      "Wikipedia Check Archived — No Candidate Sections",
      expect.any(String),
      expect.anything(),
    );
  });

  it("automatically enqueues Digger-style VF credits for fr-FR", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "VF : voix française — Jean Dupont" },
    });

    await processQueue("check", {
      dubbing_language: undefined,
      wikipedia_language: "fr",
    });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_wikipedia_language: "fr",
        p_dubbing_language: "fr-FR",
        p_section_indexes: [2],
      }),
    );
  });

  it("detects Kill Jackie-style inline VF beside the original cast", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: {
        wikitext: "Original cast: Actor One as Hero.\nVF : Jean Dupont as Hero.",
      },
    });

    await processQueue("check", {
      dubbing_language: undefined,
      wikipedia_language: "fr",
    });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [2],
      }),
    );
  });

  it("enqueues separable VF and VQ sections as independent regional jobs", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [3, 4],
      sectionCandidates: [
        { index: 3, heading: "Distribution", headingKind: "generic_cast" },
        {
          index: 4,
          heading: "Version québécoise",
          headingKind: "explicit_dubbing",
        },
      ],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockImplementation(
      async (pageId: number, index: string) => {
        expect(pageId).toBe(55);
        return {
          parse: {
            wikitext: index === "3" ? "VF : Jean Dupont as Hero." : "VQ : Marie Roy as Hero.",
          },
        };
      },
    );

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [3],
      }),
    );
    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-CA",
        p_section_indexes: [4],
      }),
    );
  });

  it("enqueues resolved sections and archives unresolved sections as a partial result", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [3, 7],
      sectionCandidates: [
        { index: 3, heading: "Distribution", headingKind: "generic_cast" },
        { index: 7, heading: "Japanese dub", headingKind: "explicit_dubbing" },
      ],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockImplementation(
      async (_pageId: number, index: string) => ({
        parse: {
          wikitext: index === "3" ? "VF : Jean Dupont as Hero." : "Japanese dub: Actor Name.",
        },
      }),
    );

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [3],
      }),
    );
    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_archive_reason: "extraction_enqueued",
        p_archive_details: expect.stringContaining("ambiguous_region"),
      }),
    );
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      "Wikipedia Dubbing Partially Resolved",
      expect.stringContaining("ambiguous_region"),
      expect.anything(),
    );
  });

  it("keeps a requested resolved target while archiving separate unresolved evidence", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [3, 7],
      sectionCandidates: [
        {
          index: 3,
          heading: "Version française",
          headingKind: "explicit_dubbing",
        },
        { index: 7, heading: "Japanese dub", headingKind: "explicit_dubbing" },
      ],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockImplementation(
      async (_pageId: number, index: string) => ({
        parse: {
          wikitext: index === "3" ? "VF : Jean Dupont as Hero." : "Japanese dub: Actor Name.",
        },
      }),
    );

    await processQueue("check", { dubbing_language: "fr-FR" });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [3],
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({ p_dubbing_language: "fr-CA" }),
    );
    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_archive_reason: "extraction_enqueued",
        p_archive_details: expect.stringContaining("ambiguous_region"),
      }),
    );
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
  });

  it("sends an operational error notification when extraction enqueue fails", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "VF : Jean Dupont as Hero." },
    });
    routeMocks.enqueueMediaExtractError = "database unavailable";

    await processQueue("check", {
      wikipedia_language: "fr",
      dubbing_language: undefined,
    });

    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      "Wikipedia Queue Error",
      expect.stringContaining("database unavailable"),
      expect.objectContaining({ color: 0xed4245 }),
    );
    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "delay_media_queue_message",
      expect.objectContaining({ p_queue_name: "wiki_check", p_msg_id: 17 }),
    );
    expect(routeMocks.sendDiscordAdminNotification.mock.calls[0]?.[1]).toContain(
      "fr-FR section(s) 2: failed — database unavailable",
    );
  });

  it("reports when malformed wiki_check payload archiving fails", async () => {
    routeMocks.archiveQueueResult.mockReturnValue({
      data: false,
      error: { message: "archive unavailable" },
    });

    await processQueue("check", { media_type: "invalid" });

    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification.mock.calls[0]?.[1]).toContain(
      "Archive error: archive unavailable",
    );
    expect(routeMocks.sendDiscordAdminNotification.mock.calls[0]?.[1]).toContain(
      "archiving failed",
    );
    expect(routeMocks.sendDiscordAdminNotification.mock.calls[0]?.[1]).not.toContain(
      "item archived as a non-retryable error",
    );
  });

  it("reports when a non-retryable Wikipedia failure was not archived", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: false,
      title: "Test movie",
      error: "invalid Wikipedia response",
      retryable: false,
    });
    routeMocks.archiveQueueResult.mockReturnValue({ data: false, error: null });

    await processQueue("check");

    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledTimes(1);
    expect(routeMocks.sendDiscordAdminNotification.mock.calls[0]?.[1]).toContain(
      "archive RPC reported that the item was not archived",
    );
  });

  it("extracts only the explicitly requested region when the page has multiple versions", async () => {
    routeMocks.checkMediaDubbingSections.mockResolvedValue({
      ok: true,
      title: "Test movie",
      sectionIndexes: [3, 4],
      sectionCandidates: [
        { index: 3, heading: "Distribution", headingKind: "generic_cast" },
        {
          index: 4,
          heading: "Version québécoise",
          headingKind: "explicit_dubbing",
        },
      ],
      pageId: 55,
    });
    routeMocks.getPageSectionAsWikitext.mockImplementation(
      async (_pageId: number, index: string) => ({
        parse: {
          wikitext: index === "3" ? "VF : Jean Dupont as Hero." : "VQ : Marie Roy as Hero.",
        },
      }),
    );

    await processQueue("check", { dubbing_language: "fr-FR" });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({
        p_dubbing_language: "fr-FR",
        p_section_indexes: [3],
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith(
      "enqueue_media_extract",
      expect.objectContaining({ p_dubbing_language: "fr-CA" }),
    );
  });

  it("does not overwrite an explicit region when evidence points elsewhere", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "VQ : voix québécoise — Marie Roy" },
    });

    await processQueue("check", { dubbing_language: "fr-FR" });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_msg_id: 17,
        p_archive_reason: "target_conflict",
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      expect.stringContaining("Wikipedia Check Archived — Target Conflict"),
      expect.any(String),
      expect.anything(),
    );
  });

  it("archives dubbing evidence with an unknown market as ambiguous", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "Japanese dub: Actor Name." },
    });

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_msg_id: 17,
        p_archive_reason: "ambiguous_region",
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      expect.stringContaining("Wikipedia Check Archived — Ambiguous Region"),
      expect.any(String),
      expect.anything(),
    );
  });

  it("archives a known unsupported market with its unsupported reason", async () => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "Argentine Spanish dubbing cast: Ana Pérez." },
    });

    await processQueue("check", { dubbing_language: undefined });

    expect(routeMocks.rpc).toHaveBeenCalledWith(
      "archive_wiki_check_with_outcome",
      expect.objectContaining({
        p_archive_reason: "unsupported_region",
        p_archive_details: expect.stringContaining("Argentine Spanish"),
      }),
    );
    expect(routeMocks.rpc).not.toHaveBeenCalledWith("enqueue_media_extract", expect.anything());
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledWith(
      "Wikipedia Check Archived — Unsupported Region",
      expect.stringContaining("unsupported_region"),
      expect.anything(),
    );
  });

  it.each([
    ["missing", {}],
    ["malformed", { requested_by: "not-a-uuid" }],
  ] as const)("does not invent a requester when the field is %s", async (_caseName, payload) => {
    routeMocks.getPageSectionAsWikitext.mockResolvedValue({
      parse: { wikitext: "VF : Jean Dupont as Hero." },
    });
    await processQueue("check", { ...payload, dubbing_language: undefined });

    const enqueue = routeMocks.rpc.mock.calls.find(([name]) => name === "enqueue_media_extract");
    expect(enqueue).toBeDefined();
    expect(enqueue?.[1]).not.toHaveProperty("p_requested_by");
  });
});
