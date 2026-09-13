import { describe, expect, it } from "vitest";
import { SimpleCache } from "./index";

interface FakeKv {
  get: (key: string, options: { type: "json" }) => Promise<unknown>;
  put: (
    key: string,
    value: string,
    options: { expirationTtl: number },
  ) => Promise<void>;
}

describe("SimpleCache", () => {
  it("reads from KV for every lookup instead of retaining an in-memory entry", async () => {
    let getCount = 0;
    const kv: FakeKv = {
      get: async () => {
        getCount += 1;
        return { value: getCount };
      },
      put: async () => undefined,
    };
    const cache = new SimpleCache(() => kv);

    await expect(cache.get<{ value: number }>("external:key")).resolves.toEqual(
      { value: 1 },
    );
    await expect(cache.get<{ value: number }>("external:key")).resolves.toEqual(
      { value: 2 },
    );
  });
});
