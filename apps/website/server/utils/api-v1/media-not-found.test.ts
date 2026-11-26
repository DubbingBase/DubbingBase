import { createClient } from "@supabase/supabase-js";
import { createApp, createRouter, toWebHandler } from "h3";
import { beforeEach, expect, it, vi } from "vitest";
import sync from "../../api/v1/[type]/[id]/credits/sync.post";
import characters from "../../api/v1/[type]/[id]/characters.get";
import createCharacter from "../../api/v1/[type]/[id]/characters.post";
import credits from "../../api/v1/[type]/[id]/credits/index.get";
import media from "../../api/v1/[type]/[id]/index.get";

const mocks = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("./tokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tokens")>()),
  authenticateApiToken: mocks.authenticateApiToken,
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }));

const router = createRouter();
const path = "/api/v1/:type/:id";
router.get(path, media);
router.get(`${path}/credits`, credits);
router.get(`${path}/characters`, characters);
router.post(`${path}/credits/sync`, sync);
router.post(`${path}/characters`, createCharacter);
const handle = toWebHandler(createApp().use(router));

const dbFetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = new URL(String(input));
  expect(url.pathname).toBe("/rest/v1/media");
  return Response.json([]);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useSupabaseAdmin.mockReturnValue(
    createClient("https://database.example", "test-key", { global: { fetch: dbFetch } }),
  );
  mocks.authenticateApiToken.mockResolvedValue({
    tokenId: "test",
    userId: "admin",
    scopes: [
      "credits:read",
      "credits:create",
      "credits:update",
      "characters:read",
      "characters:create",
    ],
  });
});

async function request(path: string, body?: unknown): Promise<Response> {
  return handle(
    new Request(`http://localhost/api/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: "Bearer dbk_live_test",
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function expectNotFound(response: Response, kind: string, message: string): Promise<void> {
  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message } });
  expect(dbFetch).toHaveBeenCalledTimes(1);
  const url = new URL(String(dbFetch.mock.calls[0]?.[0]));
  expect(url.searchParams.get("kind")).toBe(`eq.${kind}`);
  expect(url.searchParams.get("content_id")).toBe("eq.140617");
}

it.each(["", "/credits", "/characters"])(
  "reports a missing local game on GET %s",
  async (suffix) => {
    await expectNotFound(
      await request(`games/140617${suffix}`),
      "video_game",
      "Media not imported yet.",
    );
  },
);

it("reports a missing local game before registering a character", async () => {
  const response = await request("games/140617/characters", { name: "Rachel" });
  await expectNotFound(response, "video_game", "Media not imported yet.");
});

it.each(["", "?dry_run=true"])("requires a local game for a credit sync %s", async (query) => {
  const response = await request(`games/140617/credits/sync${query}`, {
    credits: [{ voice_actor_id: 5, character_name: "Rachel", language: "en-US" }],
  });
  await expectNotFound(response, "video_game", "Media not imported yet.");
});

it.each([
  ["toys", "toy"],
  ["advertisements", "advertisement"],
])("keeps the missing %s response", async (type, kind) => {
  await expectNotFound(await request(`${type}/140617`), kind, "Media not found.");
});
