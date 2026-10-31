import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({ useSupabaseAdmin: vi.fn() }));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: clientMocks.useSupabaseAdmin,
}));

let AdvertisementClient: typeof import("../api/advertisement").AdvertisementClient;

beforeAll(async () => {
  AdvertisementClient = (await import("../api/advertisement")).AdvertisementClient;
});

beforeEach(() => vi.clearAllMocks());

function createSupabaseMock(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const from = vi.fn(() => query);
  clientMocks.useSupabaseAdmin.mockReturnValue({ from });
}

describe("AdvertisementClient", () => {
  it("returns no record for a missing advertisement", async () => {
    createSupabaseMock({ data: null, error: null });

    await expect(new AdvertisementClient().getAdvertisement(1)).resolves.toBeNull();
  });

  it("preserves database errors instead of inventing advertisement metadata", async () => {
    createSupabaseMock({ data: null, error: { code: "08006" } });

    await expect(new AdvertisementClient().getAdvertisement(1)).rejects.toMatchObject({
      code: "08006",
    });
  });

  it("uses one deterministic project when an advertisement has multiple dubbing projects", async () => {
    createSupabaseMock({
      data: {
        created_at: "2026-10-01T00:00:00Z",
        studios: { name: "Example Studio" },
      },
      error: null,
    });

    await expect(new AdvertisementClient().getAdvertisement(1)).resolves.toMatchObject({
      brand: "Example Studio",
    });
  });
});
