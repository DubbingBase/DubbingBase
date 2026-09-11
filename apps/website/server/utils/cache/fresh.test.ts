import { describe, expect, it } from "vitest";
import { FreshCache, SimpleCache } from "./index";

describe("FreshCache", () => {
  it("always misses reads while staying a SimpleCache for writes", async () => {
    const cache = new FreshCache(() => null);
    expect(cache).toBeInstanceOf(SimpleCache);
    await expect(cache.get("anything")).resolves.toBeNull();
  });
});
