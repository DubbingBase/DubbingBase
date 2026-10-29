import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
  type EventHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getTopContributors: vi.fn() }));

vi.mock("../utils/db/queries", () => ({
  getTopContributors: mocks.getTopContributors,
}));

let handler: EventHandler;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("./top-contributors.get")).default;
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

describe("top contributor response projection", () => {
  it("keeps the full metadata in the default response", async () => {
    mocks.getTopContributors.mockResolvedValue([
      {
        user_id: "user-1",
        score: 12,
        raw_user_meta_data: {
          username: "Ada",
          avatar_url: "ada.jpg",
          biography: "Full biography",
        },
      },
    ]);

    const response = await request("/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        user_id: "user-1",
        score: 12,
        raw_user_meta_data: {
          username: "Ada",
          avatar_url: "ada.jpg",
          biography: "Full biography",
        },
      },
    ]);
    expect(mocks.getTopContributors).toHaveBeenCalledWith(10);
  });

  it("returns only the metadata used by the homepage card", async () => {
    mocks.getTopContributors.mockResolvedValue([
      {
        user_id: "user-1",
        score: 12,
        raw_user_meta_data: {
          username: "Ada",
          avatar_url: "ada.jpg",
          biography: "Full biography",
        },
      },
    ]);

    const response = await request("/?projection=home");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        user_id: "user-1",
        score: 12,
        raw_user_meta_data: { username: "Ada", avatar_url: "ada.jpg" },
      },
    ]);
  });
});
