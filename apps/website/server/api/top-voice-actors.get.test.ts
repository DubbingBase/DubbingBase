import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
  type EventHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

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
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("./top-voice-actors.get")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

async function request(path: string): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(new Request(`http://localhost${path}`));
}

describe("top voice actor response projection", () => {
  it("keeps the full default response for existing callers", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          voice_actor: {
            id: 1,
            firstname: "Ada",
            lastname: "Example",
            profile_picture: "ada.jpg",
            bio: "Full biography",
          },
          role_count: 12,
        },
      ],
      error: null,
    });

    const response = await request("/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 1,
        firstname: "Ada",
        lastname: "Example",
        profile_picture: "https://images.example/ada.jpg",
        bio: "Full biography",
        role_count: 12,
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("get_top_voice_actors", {
      limit_param: 10,
    });
  });

  it("returns only the fields used by the homepage rail", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          voice_actor: {
            id: 1,
            firstname: "Ada",
            lastname: "Example",
            profile_picture: "ada.jpg",
            bio: "Full biography",
          },
          role_count: 12,
        },
      ],
      error: null,
    });

    const response = await request("/?projection=home");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 1,
        firstname: "Ada",
        lastname: "Example",
        profile_picture: "https://images.example/ada.jpg",
      },
    ]);
  });
});
