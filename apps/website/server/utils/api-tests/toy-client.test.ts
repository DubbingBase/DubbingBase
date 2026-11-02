import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({ useSupabaseAdmin: vi.fn() }));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: clientMocks.useSupabaseAdmin,
}));

let ToyClient: typeof import("../api/toy").ToyClient;

beforeAll(async () => {
  ToyClient = (await import("../api/toy")).ToyClient;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  const from = vi.fn(() => query);
  clientMocks.useSupabaseAdmin.mockReturnValue({ from });
  return { from };
}

describe("ToyClient", () => {
  it("returns persisted toy metadata for a detail page", async () => {
    const { from } = createSupabaseMock({
      data: {
        content_id: 1,
        name: "Lunii Storyteller",
        manufacturer: "Lunii",
        product_line: "My Fabulous Storyteller",
        release_year: 2022,
        cover_url: "https://example.com/lunii.jpg",
        description: "A screen-free audio storyteller.",
        updated_at: "2026-10-23T12:00:00Z",
      },
      error: null,
    });

    const toy = await new ToyClient().getToy(1);

    expect(from).toHaveBeenCalledWith("toy_metadata");
    expect(toy).toEqual({
      id: 1,
      name: "Lunii Storyteller",
      manufacturer: "Lunii",
      product_line: "My Fabulous Storyteller",
      release_year: 2022,
      cover_url: "https://example.com/lunii.jpg",
      description: "A screen-free audio storyteller.",
      updated_at: "2026-10-23T12:00:00Z",
      media_type: "toy",
    });
  });

  it("does not invent metadata when no toy record exists", async () => {
    createSupabaseMock({ data: null, error: null });

    await expect(new ToyClient().getToy(1)).resolves.toBeNull();
  });

  it("preserves database errors instead of reporting a missing toy", async () => {
    createSupabaseMock({ data: null, error: { code: "08006" } });

    await expect(new ToyClient().getToy(1)).rejects.toMatchObject({
      code: "08006",
    });
  });
});
