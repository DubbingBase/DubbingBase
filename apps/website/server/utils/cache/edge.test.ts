import { describe, expect, it } from "vitest";
import { edgeCache } from "./edge";

describe("edgeCache", () => {
  it("keeps only successful responses for the lifetime", () => {
    expect(edgeCache(3600)).toEqual({
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": 3600, "404": 60, "500-599": 0 },
      },
    });
  });

  it("is a no-op for a zero lifetime", () => {
    expect(edgeCache(0)).toEqual({});
  });
});
