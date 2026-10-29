import { createApp, createError, defineEventHandler, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({ useSupabaseAdmin: vi.fn() }));

vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

type StudioRow = {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  website_url: string | null;
};

type StudiosResult = {
  data: StudioRow[];
  count: number;
  error: null;
};

class StudioQuery implements PromiseLike<StudiosResult> {
  columns = "";
  options: { count?: "exact" } | undefined;

  constructor(private readonly result: StudiosResult) {}

  select(columns: string, options?: { count?: "exact" }): this {
    this.columns = columns;
    this.options = options;
    return this;
  }

  order(): this {
    return this;
  }

  range(): this {
    return this;
  }

  or(): this {
    return this;
  }

  then<TResult1 = StudiosResult, TResult2 = never>(
    onfulfilled?: ((value: StudiosResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

let handler: typeof import("../../api/get-studio-details.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../../api/get-studio-details.get")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

async function getStudios(query: string) {
  const studio: StudioRow = {
    id: 12,
    name: "Example Studio",
    city: "Paris",
    country: "France",
    logo_url: "https://example.com/logo.png",
    website_url: "https://example.com",
  };
  const builder = new StudioQuery({ data: [studio], count: 1, error: null });
  routeMocks.useSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => builder),
  });

  const app = createApp();
  app.use("/", defineEventHandler((event) => handler(event)));
  const response = await toWebHandler(app)(
    new Request(`http://localhost/${query}`),
  );
  return { builder, response, studio };
}

describe("GET /api/get-studio-details directory listing", () => {
  it("selects only fields used by the studios directory when requested", async () => {
    const { builder, response, studio } = await getStudios(
      "?limit=20&offset=0&view=directory",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ studios: [studio], total: 1 });
    expect(builder.columns).toBe("id,name,city,country,logo_url");
    expect(builder.options).toEqual({ count: "exact" });
  });

  it("keeps selecting full studio rows for existing callers by default", async () => {
    const { builder, response, studio } = await getStudios("?limit=20&offset=0");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ studios: [studio], total: 1 });
    expect(builder.columns).toBe("*");
    expect(builder.options).toEqual({ count: "exact" });
  });
});
