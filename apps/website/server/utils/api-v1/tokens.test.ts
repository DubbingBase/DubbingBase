import { describe, expect, it } from "vitest";
import {
  API_TOKEN_PREFIX,
  consumeIpRateLimit,
  consumeRateLimit,
  generateApiToken,
  hashApiToken,
} from "./tokens";

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

  it("limits a client address independently of any token and stays bounded", () => {
    const start = 2_000_000;
    let last = consumeIpRateLimit("203.0.113.9", start);
    for (let i = 1; i < 600; i += 1) last = consumeIpRateLimit("203.0.113.9", start + i);
    expect(last.allowed).toBe(true);
    expect(consumeIpRateLimit("203.0.113.9", start + 700).allowed).toBe(false);
    expect(consumeIpRateLimit("203.0.113.10", start + 700).allowed).toBe(true);
    // Far more distinct keys than the table holds must not grow it without bound or throw.
    for (let i = 0; i < 12_000; i += 1) consumeIpRateLimit(`198.51.100.${i}`, start + 800);
    expect(consumeIpRateLimit("198.51.100.1", start + 900).allowed).toBe(true);
  });
});
