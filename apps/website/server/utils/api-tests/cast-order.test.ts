import { createApp, createRouter, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiScope } from "../../../shared/api-scopes";

const routeMocks = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  notifyContributionEdit: vi.fn(),
}));

vi.mock("../api-v1/tokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-v1/tokens")>()),
  authenticateApiToken: routeMocks.authenticateApiToken,
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));
vi.mock("../notifications/contribution", () => ({
  notifyContributionEdit: routeMocks.notifyContributionEdit,
}));

type QueryResult = { data: unknown; error: null };

/** A Supabase query builder stand-in that returns the rows given for its table. */
class Query implements PromiseLike<QueryResult> {
  constructor(private readonly value: unknown) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  in() {
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: Array.isArray(this.value) ? (this.value[0] ?? null) : this.value,
      error: null,
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.value, error: null }).then(onfulfilled, onrejected);
  }
}

const GAME = 19565;
const PETER = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const MAY = "1b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const MARTIN = "2b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const UPDATED_AT = "2026-11-26T10:00:00+00:00";
const voiceActor = { id: 12, firstname: "Donald", lastname: "Reignoux" };

/** The game, with its cast order (the shape loadGameCastOrder reads). */
function gameMedia(version: number, ids: string[]) {
  const names: Record<string, string> = {
    [PETER]: "Peter Parker",
    [MAY]: "Aunt May",
    [MARTIN]: "Martin Li",
  };
  return {
    id: 801,
    kind: "video_game",
    content_id: GAME,
    game_cast_orders: {
      version,
      game_cast_order_entries: ids.map((id, index) => ({
        position: index + 1,
        game_character_id: id,
        game_characters: { name: names[id] ?? id },
      })),
    },
  };
}

/** The credit row the PATCH route reads (CREDIT_SELECT shape). */
function creditRow(position: number | null, gameCharacterId: string | null = PETER) {
  return {
    id: 501,
    character_name: "Peter Parker",
    actor_id: gameCharacterId === null ? 7001 : null,
    game_character_id: gameCharacterId,
    performance: "dialogues",
    note: null,
    highlight: true,
    reviewed_status: "accepted",
    updated_at: UPDATED_AT,
    voice_actors: voiceActor,
    game_character:
      gameCharacterId === null ? null : { cast_order: position === null ? null : { position } },
    dubbing_projects: {
      language: "fr-FR",
      media: { id: 801, kind: "video_game", content_id: GAME },
    },
  };
}

function syncWork(gameCharacterId: string | null = PETER) {
  return {
    id: 501,
    character_name: "Peter Parker",
    actor_id: null,
    game_character_id: gameCharacterId,
    highlight: true,
    performance: "dialogues",
    updated_at: UPDATED_AT,
  };
}

/** What api_mutate_credits returns after a write that placed characters. */
function written(position: number | null, version: number, order: string[], created = false) {
  return {
    data: [
      {
        work_id: 501,
        created,
        after: {
          performance: "dialogues",
          updated_at: UPDATED_AT,
          note: null,
          highlight: true,
          reviewed_status: "accepted",
          character_name: "Peter Parker",
          actor_id: null,
          game_character_id: PETER,
          cast_rank: position,
        },
        cast_order: {
          version,
          characters: order.map((id, index) => ({
            game_character_id: id,
            name: id,
            position: index + 1,
          })),
        },
      },
    ],
    error: null,
  };
}

let tables: Record<string, unknown> = {};
let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  const [patchRoute, syncRoute, getOrder, putOrder] = await Promise.all([
    import("../../api/v1/[type]/[id]/credits/[workId].patch"),
    import("../../api/v1/[type]/[id]/credits/sync.post"),
    import("../../api/v1/[type]/[id]/cast-order.get"),
    import("../../api/v1/[type]/[id]/cast-order.put"),
  ]);
  const router = createRouter();
  router.patch("/:type/:id/credits/:workId", patchRoute.default);
  router.post("/:type/:id/credits/sync", syncRoute.default);
  router.get("/:type/:id/cast-order", getOrder.default);
  router.put("/:type/:id/cast-order", putOrder.default);
  const app = createApp();
  app.use(router);
  handle = toWebHandler(app);
});

beforeEach(() => {
  vi.clearAllMocks();
  tables = {
    media: gameMedia(3, [MAY, MARTIN]),
    dubbing_projects: [
      { id: 71, language: "fr-FR", media: { id: 801, kind: "video_game", content_id: GAME } },
    ],
    voice_actors: voiceActor,
    game_characters: { id: PETER },
  };
  routeMocks.authenticateApiToken.mockResolvedValue({
    tokenId: "token",
    userId: "admin-user",
    scopes: [
      "credits:read",
      "credits:create",
      "credits:update",
      "characters:read",
      "characters:update",
    ] satisfies ApiScope[],
  });
  routeMocks.from.mockImplementation((table: string) => new Query(tables[table] ?? null));
  routeMocks.useSupabaseAdmin.mockImplementation(() => ({
    from: routeMocks.from,
    rpc: routeMocks.rpc,
  }));
});

afterAll(() => vi.unstubAllGlobals());

function request(
  path: string,
  method: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    authorization: "Bearer dbk_live_test",
    "idempotency-key": "11111111-1111-4111-8111-111111111111",
    ...extraHeaders,
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  return handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("GET and PUT /games/{id}/cast-order", () => {
  it("returns the order at positions 1..n with a version ETag", async () => {
    const response = await request(`/games/${GAME}/cast-order`, "GET");

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"cast-order-3"');
    await expect(response.json()).resolves.toEqual({
      path: `/api/v1/games/${GAME}/cast-order`,
      version: 3,
      characters: [
        { position: 1, game_character_id: MAY, name: "Aunt May" },
        { position: 2, game_character_id: MARTIN, name: "Martin Li" },
      ],
    });
  });

  it("replaces the whole order against the version in If-Match", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: {
        version: 4,
        characters: [
          { game_character_id: PETER, name: "Peter Parker", position: 1 },
          { game_character_id: MAY, name: "Aunt May", position: 2 },
        ],
      },
      error: null,
    });

    const response = await request(
      `/games/${GAME}/cast-order`,
      "PUT",
      { characters: [PETER, MAY] },
      { "if-match": '"cast-order-3"' },
    );

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledWith("set_game_cast_order", {
      p_actor_id: "admin-user",
      p_igdb_game_id: GAME,
      p_character_ids: [PETER, MAY],
      p_expected_version: 3,
      p_origin: "api",
    });
    expect(response.headers.get("etag")).toBe('"cast-order-4"');
  });

  it("requires If-Match, and answers 412 when the order changed", async () => {
    const missing = await request(`/games/${GAME}/cast-order`, "PUT", { characters: [] });
    expect(missing.status).toBe(428);

    routeMocks.rpc.mockResolvedValue({ data: null, error: { code: "PT412" } });
    const stale = await request(
      `/games/${GAME}/cast-order`,
      "PUT",
      { characters: [] },
      { "if-match": '"cast-order-2"' },
    );
    expect(stale.status).toBe(412);
    expect(stale.headers.get("etag")).toBe('"cast-order-3"');
  });

  it("rejects a character listed twice before any write", async () => {
    const response = await request(
      `/games/${GAME}/cast-order`,
      "PUT",
      { characters: [MAY, MAY] },
      { "if-match": '"cast-order-3"' },
    );
    expect(response.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("only exists for games", async () => {
    expect((await request("/movies/603/cast-order", "GET")).status).toBe(400);
  });
});

describe("PATCH /credits/{workId} cast_rank", () => {
  it("places the character with the order version it read, and returns its position", async () => {
    tables.work = creditRow(null);
    routeMocks.rpc.mockResolvedValue(written(1, 4, [PETER, MAY, MARTIN]));

    const response = await request(`/games/${GAME}/credits/501`, "PATCH", { cast_rank: 1 });

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledWith("api_mutate_credits", {
      p_user_id: "admin-user",
      p_operation: "update",
      p_items: [
        { work_id: 501, expected_updated_at: UPDATED_AT, cast_rank: 1, cast_order_version: 3 },
      ],
    });
    expect(response.headers.get("etag")).toBe(`"${UPDATED_AT}#1"`);
    await expect(response.json()).resolves.toMatchObject({ id: 501, cast_rank: 1 });
  });

  it("refuses to rank a credit without a game character instead of guessing a link", async () => {
    tables.work = creditRow(null, null);
    const response = await request(`/games/${GAME}/credits/501`, "PATCH", { cast_rank: 1 });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unlinked_credit" } });
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses a rank past the end of the order before writing", async () => {
    tables.work = creditRow(null);
    // [May, Martin] + Peter: the highest rank is 3.
    const response = await request(`/games/${GAME}/credits/501`, "PATCH", { cast_rank: 4 });
    expect(response.status).toBe(422);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("maps an order changed in between to 412", async () => {
    tables.work = creditRow(null);
    routeMocks.rpc.mockResolvedValue({ data: null, error: { code: "PT412", hint: null } });
    const response = await request(`/games/${GAME}/credits/501`, "PATCH", { cast_rank: 1 });
    expect(response.status).toBe(412);
  });

  it("refuses an If-Match taken before the rank changed", async () => {
    tables.work = creditRow(2);
    const stale = await request(
      `/games/${GAME}/credits/501`,
      "PATCH",
      { cast_rank: 1 },
      { "if-match": `"${UPDATED_AT}"` },
    );
    expect(stale.status).toBe(412);
    expect(stale.headers.get("etag")).toBe(`"${UPDATED_AT}#2"`);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", 0],
    ["a fraction", 1.5],
    ["a string", "1"],
  ])("rejects a rank that is %s", async (_label, castRank) => {
    tables.work = creditRow(null);
    const response = await request(`/games/${GAME}/credits/501`, "PATCH", { cast_rank: castRank });
    expect(response.status).toBe(400);
  });
});

describe("POST /credits/sync cast_rank", () => {
  const item = {
    voice_actor_id: 12,
    character_name: "Peter Parker",
    language: "fr-FR",
    game_character_id: PETER,
  };

  it("previews the whole resulting order on a dry run, without writing", async () => {
    tables.work = [syncWork()];

    const response = await request(`/games/${GAME}/credits/sync?dry_run=true`, "POST", {
      credits: [{ ...item, cast_rank: 1 }],
    });

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      dry_run: true,
      data: [
        {
          action: "update",
          credit: `/api/v1/games/${GAME}/credits/501`,
          linked_game_character_id: null,
          changes: { cast_rank: { from: null, to: 1 } },
          would_create: null,
        },
      ],
      cast_order: { version: 3, from: [MAY, MARTIN], to: [PETER, MAY, MARTIN] },
    });
  });

  it("reports a rank already in place as unchanged and does not write", async () => {
    tables.media = gameMedia(3, [PETER, MAY]);
    tables.work = [syncWork()];

    const response = await request(`/games/${GAME}/credits/sync`, "POST", {
      credits: [{ ...item, cast_rank: 1 }],
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [{ action: "unchanged", changes: null }],
      cast_order: { version: 3, from: [PETER, MAY], to: [PETER, MAY] },
    });
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("applies the previewed order with its version and returns the new one", async () => {
    tables.work = [syncWork()];
    routeMocks.rpc.mockResolvedValue(written(1, 4, [PETER, MAY, MARTIN]));

    const response = await request(`/games/${GAME}/credits/sync`, "POST", {
      credits: [{ ...item, highlight: true, cast_rank: 1 }],
      cast_order_version: 3,
    });

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledWith("api_mutate_credits", {
      p_user_id: "admin-user",
      p_operation: "sync",
      p_items: [
        { work_id: 501, expected_updated_at: UPDATED_AT, cast_rank: 1, cast_order_version: 3 },
      ],
    });
    await expect(response.json()).resolves.toMatchObject({
      dry_run: false,
      data: [{ action: "update", changes: { cast_rank: { from: null, to: 1 } } }],
      cast_order: { version: 4, from: [MAY, MARTIN], to: [PETER, MAY, MARTIN] },
    });
  });

  it("refuses a sync whose previewed version is stale", async () => {
    tables.work = [syncWork()];
    const response = await request(`/games/${GAME}/credits/sync`, "POST", {
      credits: [{ ...item, cast_rank: 1 }],
      cast_order_version: 2,
    });
    expect(response.status).toBe(412);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses two characters with the same rank", async () => {
    tables.work = [];
    const response = await request(`/games/${GAME}/credits/sync?dry_run=true`, "POST", {
      credits: [
        { ...item, cast_rank: 1 },
        {
          ...item,
          voice_actor_id: 12,
          character_name: "Aunt May",
          game_character_id: MAY,
          cast_rank: 1,
        },
      ],
    });
    expect(response.status).toBe(422);
  });

  it("refuses to rank a credit that has no game character", async () => {
    tables.work = [syncWork(null)];
    const response = await request(`/games/${GAME}/credits/sync?dry_run=true`, "POST", {
      credits: [{ ...item, game_character_id: null, cast_rank: 1 }],
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unlinked_credit" } });
  });

  it("sends every rank of the request when the order changes, including ones already in place", async () => {
    // [Peter, May]: Martin to 1 moves Peter to 2, so Peter's rank 2... must be sent too.
    tables.media = gameMedia(3, [PETER, MAY]);
    tables.work = [syncWork()];
    routeMocks.rpc.mockResolvedValue({
      data: [
        { ...written(2, 4, [MARTIN, PETER, MAY]).data[0], work_id: 501 },
        { ...written(1, 4, [MARTIN, PETER, MAY], true).data[0], work_id: 502 },
      ],
      error: null,
    });

    const response = await request(`/games/${GAME}/credits/sync`, "POST", {
      credits: [
        { ...item, cast_rank: 2 },
        { ...item, character_name: "Martin Li", game_character_id: MARTIN, cast_rank: 1 },
      ],
    });

    expect(response.status).toBe(200);
    const call: unknown = routeMocks.rpc.mock.calls[0]?.[1];
    expect(call).toMatchObject({
      p_items: [
        { work_id: 501, cast_rank: 2, cast_order_version: 3 },
        { character_name: "Martin Li", cast_rank: 1, cast_order_version: 3 },
      ],
    });
  });
});
