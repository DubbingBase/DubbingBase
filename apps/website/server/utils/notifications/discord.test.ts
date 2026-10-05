import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDiscordEmbed, normalizeDiscordUrl, sendDiscordAdminNotification } from "./discord";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Discord admin notifications", () => {
  it("normalizes internal URLs once and preserves external URLs", () => {
    expect(normalizeDiscordUrl("/movie/42")).toBe("https://dubbingbase.com/fr/movie/42");
    expect(normalizeDiscordUrl("/fr/show/42")).toBe("https://dubbingbase.com/fr/show/42");
    expect(normalizeDiscordUrl("https://en.wikipedia.org/wiki/Example")).toBe(
      "https://en.wikipedia.org/wiki/Example",
    );
  });

  it.each([
    ["wiki_discovery", "Discovery"],
    ["wiki_check", "Check"],
    ["wiki_extract", "Extract"],
  ] as const)("identifies %s notifications", (queue, label) => {
    const embed = buildDiscordEmbed("Queue event", "Details", { queue });
    expect(embed.title).toBe(`[${label}] Queue event`);
    expect(embed.author).toEqual({ name: `DubbingBase • ${label}` });
    expect(embed.footer).toEqual({
      text: "DubbingBase Admin Notifications",
    });
  });

  it("uses a consistent neutral default and truncates descriptions", () => {
    const embed = buildDiscordEmbed("Event", "x".repeat(2100));
    expect(embed.color).toBe(0x2a2a2a);
    expect(String(embed.description)).toHaveLength(1996);
    expect(String(embed.description)).toContain("(truncated)");
  });

  it("sends wiki_check outcomes to only the first valid configured webhook", async () => {
    vi.stubEnv(
      "NUXT_DISCORD_WEBHOOK_CHECK_URL",
      "bad-url,https://discord.example/check-primary,https://discord.example/check-secondary",
    );
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendDiscordAdminNotification("Outcome", "Details", {
      queue: "wiki_check",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://discord.example/check-primary");
  });

  it("uses only the first fallback webhook when wiki_check has no dedicated URL", async () => {
    for (const key of [
      "NUXT_DISCORD_WEBHOOK_CHECK_URL",
      "DISCORD_WEBHOOK_CHECK_URL",
      "DISCORD_CHECK_WEBHOOK_URL",
    ]) {
      vi.stubEnv(key, "");
    }
    vi.stubEnv(
      "NUXT_DISCORD_WEBHOOK_URL",
      "https://discord.example/fallback-primary,https://discord.example/fallback-secondary",
    );
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendDiscordAdminNotification("Outcome", "Details", {
      queue: "wiki_check",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://discord.example/fallback-primary");
  });

  it("logs when the wiki_check webhook POST fails", async () => {
    vi.stubEnv("NUXT_DISCORD_WEBHOOK_CHECK_URL", "https://discord.example/check");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unavailable", { status: 503 })),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sendDiscordAdminNotification("Outcome", "Details", {
      queue: "wiki_check",
    });

    expect(error).toHaveBeenCalledWith(
      "[Discord] wiki_check notification POST failed (status 503):",
      "Unavailable",
    );
  });

  it("logs when no wiki_check webhook is configured", async () => {
    for (const key of [
      "NUXT_DISCORD_WEBHOOK_DISCOVERY_URL",
      "DISCORD_WEBHOOK_DISCOVERY_URL",
      "DISCORD_DISCOVERY_WEBHOOK_URL",
      "NUXT_DISCORD_WEBHOOK_EXTRACT_URL",
      "DISCORD_WEBHOOK_EXTRACT_URL",
      "DISCORD_EXTRACT_WEBHOOK_URL",
      "NUXT_DISCORD_WEBHOOK_CHECK_URL",
      "DISCORD_WEBHOOK_CHECK_URL",
      "DISCORD_CHECK_WEBHOOK_URL",
      "NUXT_DISCORD_WEBHOOK_URL",
      "DISCORD_WEBHOOK_URL",
      "DISCORD_ADMIN_WEBHOOK_LOG_URL",
      "NUXT_DISCORD_WEBHOOK_URL_1",
      "DISCORD_WEBHOOK_URL_1",
      "NUXT_DISCORD_WEBHOOK_URL_2",
      "DISCORD_WEBHOOK_URL_2",
      "NUXT_DISCORD_WEBHOOK_URL_3",
      "DISCORD_WEBHOOK_URL_3",
    ]) {
      vi.stubEnv(key, "");
    }
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sendDiscordAdminNotification("Outcome", "Details", {
      queue: "wiki_check",
    });

    expect(error).toHaveBeenCalledWith(
      "[Discord] wiki_check notification not attempted: no valid queue-specific or fallback webhook URL configured",
    );
  });
});
