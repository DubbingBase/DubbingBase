import { describe, expect, it } from "vitest";
import { API_TOKEN_PREFIX, consumeRateLimit, generateApiToken, hashApiToken } from "./tokens";

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

  it("limits a token per window and resets afterwards", () => {
    const id = crypto.randomUUID();
    const start = 1_000_000;
    let last = consumeRateLimit(id, start);
    for (let i = 1; i < 120; i += 1) last = consumeRateLimit(id, start + i);
    expect(last).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = consumeRateLimit(id, start + 500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(consumeRateLimit(id, start + 61_000).allowed).toBe(true);
  });
});
