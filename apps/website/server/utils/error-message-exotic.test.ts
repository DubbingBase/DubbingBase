import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./error-message";

describe("getErrorMessage exotic shapes", () => {
  it("never returns the literal [object Object]", () => {
    const exotic: unknown[] = [
      new DOMException("Network request failed", "NetworkError"),
      new Response("x", { status: 500 }),
      { message: { code: 1, nested: true } },
      Object.assign(Object.create(null), { code: "PGRST123" }),
      { data: 1n },
      new Error(),
      {
        toJSON() {
          return undefined;
        },
      },
      { message: 42 },
      ["just", "array"],
      0,
      false,
    ];
    for (const e of exotic) {
      const msg = getErrorMessage(e);
      expect(msg).not.toBe("[object Object]");
    }
  });
});
