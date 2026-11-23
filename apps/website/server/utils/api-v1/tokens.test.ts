import { describe, expect, it } from "vitest";
import { API_TOKEN_PREFIX, generateApiToken, hashApiToken } from "./tokens";

describe("API tokens", () => {
  it("generates a prefixed token whose hash matches and whose prefix is a display stub", async () => {
    const { token, prefix, hash } = await generateApiToken();
    expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(token.length / 2);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashApiToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("never repeats a token", async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, () => generateApiToken()));
    expect(new Set(tokens.map((entry) => entry.token)).size).toBe(20);
  });
});
