import { describe, expect, it } from "vitest";
import { getPublicCacheControl } from "./http";

describe("public cache profiles", () => {
  it("keeps mutable detail responses at a short edge TTL", () => {
    expect(getPublicCacheControl("detail")).toBe(
      "public, max-age=300, s-maxage=600, stale-while-revalidate=900",
    );
  });

  it("keeps search responses shorter than other public responses", () => {
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    );
  });
});
