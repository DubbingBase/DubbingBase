import { beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const mocks = vi.hoisted(() => ({ useSupabaseAdmin: vi.fn() }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }));

import { authenticateApiToken } from "./tokens";

const HOUR = 3_600_000;

interface Row {
  id: string;
  user_id: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

function setup(
  row: Row | null,
  owner: { app_metadata?: { role?: string }; banned_until?: string } | null,
) {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
    update,
  }));
  const getUserById = vi.fn(async () => ({ data: { user: owner } }));
  mocks.useSupabaseAdmin.mockReturnValue({ from, auth: { admin: { getUserById } } });
  return { update };
}

const base: Row = {
  id: "t1",
  user_id: "u1",
  scopes: ["voice-actors:read", "voice-actors:write", "unknown:scope"],
  expires_at: null,
  revoked_at: null,
  last_used_at: new Date().toISOString(),
};
const admin = { app_metadata: { role: "admin" } };
const event: H3Event = Object.create(null);

beforeEach(() => vi.clearAllMocks());

describe("authenticateApiToken", () => {
  it("accepts an active token owned by an admin and drops unknown scopes", async () => {
    setup(base, admin);
    expect(await authenticateApiToken(event, "dbk_live_x")).toEqual({
      tokenId: "t1",
      userId: "u1",
      scopes: ["voice-actors:read", "voice-actors:write"],
    });
  });

  it.each([
    ["unknown token", null, admin],
    ["revoked token", { ...base, revoked_at: new Date().toISOString() }, admin],
    ["expired token", { ...base, expires_at: new Date(Date.now() - HOUR).toISOString() }, admin],
    ["deleted owner", base, null],
    ["owner demoted from admin", base, { app_metadata: { role: "user" } }],
    ["banned owner", base, { ...admin, banned_until: new Date(Date.now() + HOUR).toISOString() }],
  ])("rejects %s", async (_name, row, owner) => {
    setup(row, owner);
    expect(await authenticateApiToken(event, "dbk_live_x")).toBeNull();
  });

  it("accepts an owner whose ban has ended", async () => {
    setup(base, { ...admin, banned_until: new Date(Date.now() - HOUR).toISOString() });
    expect(await authenticateApiToken(event, "dbk_live_x")).not.toBeNull();
  });

  it("refreshes last_used_at only when it is stale", async () => {
    const fresh = setup(base, admin);
    await authenticateApiToken(event, "dbk_live_x");
    expect(fresh.update).not.toHaveBeenCalled();
    const stale = setup({ ...base, last_used_at: null }, admin);
    await authenticateApiToken(event, "dbk_live_x");
    expect(stale.update).toHaveBeenCalledOnce();
  });
});
