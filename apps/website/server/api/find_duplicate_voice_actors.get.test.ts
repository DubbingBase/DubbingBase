import { createApp, createError, defineEventHandler, toWebHandler, type EventHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireAdmin: vi.fn() }));

vi.mock("../utils/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("../utils/db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: mocks.rpc }),
}));
vi.mock("../utils/urls/supabase", () => ({
  buildSupabaseImageUrl: (path: string | null) => (path ? `https://images.example/${path}` : null),
}));

let handler: EventHandler;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  handler = (await import("./find_duplicate_voice_actors.get")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

async function request(): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(new Request("http://localhost/"));
}

describe("duplicate voice actor response projection", () => {
  it("returns only actor fields consumed by the duplicates page", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          actors: [
            {
              id: 1,
              firstname: "Ada",
              lastname: "Example",
              bio: "Biography",
              nationality: "Canadian",
              date_of_birth: "1980-01-01",
              tmdb_id: 12,
              wikidata_id: "Q123",
              profile_picture: "ada.jpg",
              read_ct: 5,
              social_media_links: [{ platform: "example" }],
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      ],
      error: null,
    });

    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        actors: [
          {
            id: 1,
            firstname: "Ada",
            lastname: "Example",
            bio: "Biography",
            nationality: "Canadian",
            date_of_birth: "1980-01-01",
            tmdb_id: 12,
            wikidata_id: "Q123",
            profile_picture: "https://images.example/ada.jpg",
          },
        ],
      },
    ]);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("find_duplicate_voice_actors_rpc");
  });
});
