import { describe, expect, it } from "vitest";
import { getHydrationCachedData } from "./getHydrationCachedData";

describe("getHydrationCachedData", () => {
  it("reuses the SSR payload during initial hydration", () => {
    const payloadData = { dubbingProjects: [{ id: 1 }] };

    expect(
      getHydrationCachedData("detail", {
        isHydrating: true,
        payload: { data: { detail: payloadData } },
      }),
    ).toBe(payloadData);
  });

  it("does not reuse payload data during later client navigation", () => {
    const payloadData = { dubbingProjects: [{ id: 1 }] };

    expect(
      getHydrationCachedData("detail", {
        isHydrating: false,
        payload: { data: { detail: payloadData } },
      }),
    ).toBeUndefined();
  });
});
