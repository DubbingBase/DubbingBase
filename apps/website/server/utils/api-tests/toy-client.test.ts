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
    or: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.or.mockReturnValue(query);
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

  it("finds toys by manufacturer and product line as well as name", async () => {
    const query = {
      select: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(async () => ({
        data: [{
          content_id: 1,
          name: "Storyteller",
          manufacturer: "Lunii",
          product_line: "My Fabulous Storyteller",
          release_year: null,
          cover_url: null,
          description: null,
          updated_at: "2026-10-23T12:00:00Z",
        }],
        error: null,
      })),
    };
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    clientMocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    const results = await new ToyClient().searchToys("  Lunii  ");

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike."%Lunii%",manufacturer.ilike."%Lunii%",product_line.ilike."%Lunii%"',
    );
    expect(results[0]?.manufacturer).toBe("Lunii");
  });

  it("preserves punctuation while safely quoting the PostgREST search value", async () => {
    const query = {
      select: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    clientMocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    await new ToyClient().searchToys('Fisher-Price, "Little People"');

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike."%Fisher-Price, \\"Little People\\"%",manufacturer.ilike."%Fisher-Price, \\"Little People\\"%",product_line.ilike."%Fisher-Price, \\"Little People\\"%"',
    );
  });

  it("treats percent and underscore as literal search characters", async () => {
    const query = {
      select: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    clientMocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    await new ToyClient().searchToys("100%_");

    expect(query.or).toHaveBeenCalledWith(
      'name.ilike."%100\\\\%\\\\_%",manufacturer.ilike."%100\\\\%\\\\_%",product_line.ilike."%100\\\\%\\\\_%"',
    );
  });

  it("preserves database errors instead of reporting a missing toy", async () => {
    createSupabaseMock({ data: null, error: { code: "08006" } });

    await expect(new ToyClient().getToy(1)).rejects.toMatchObject({
      code: "08006",
    });
  });
});
