import { afterEach, describe, expect, it, vi } from "vitest";
import { useRuntimeConfig } from "#app/nuxt";
import { createEvent, type H3Event } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { readProperty } from "@app/shared-logic";
import {
  beginDiscordDigest,
  buildDigestMessages,
  embedChars,
  errorFields,
  buildDiscordEmbed,
  condenseMessage,
  flushDiscordDigest,
  normalizeDiscordUrl,
  sendDiscordAdminNotification,
} from "./discord";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Discord admin notifications", () => {
  it("allows routine notifications with a parsed boolean runtime override", async () => {
    const config = useRuntimeConfig();
    const previousValue: unknown = Reflect.get(config, "discordNotifyRoutine");
    Reflect.set(config, "discordNotifyRoutine", true);
    vi.stubEnv("DISCORD_NOTIFY_ROUTINE", "false");
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example/general");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await sendDiscordAdminNotification("Enqueued", "Details", { routine: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.set(config, "discordNotifyRoutine", previousValue);
    }
  });

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

  it.each([
    ["/poster.jpg", "https://image.tmdb.org/t/p/w500/poster.jpg"],
    ["igdb:co42", "https://images.igdb.com/igdb/image/upload/t_cover_big/co42.jpg"],
  ])("resolves %s for external embeds", (imageUrl, url) => {
    expect(buildDiscordEmbed("Event", "Details", { imageUrl }).image).toEqual({ url });
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

  it("suppresses routine notifications unless DISCORD_NOTIFY_ROUTINE=true", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example/general");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});

    await sendDiscordAdminNotification("Enqueued", "Details", { routine: true });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("DISCORD_NOTIFY_ROUTINE", "true");
    await sendDiscordAdminNotification("Enqueued", "Details", { routine: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Discord digest grouping", () => {
  const fakeEvent = (): H3Event => {
    const request = new IncomingMessage(new Socket());
    return createEvent(request, new ServerResponse(request));
  };

  it("posts one grouped message for several notifications of one request", async () => {
    vi.stubEnv("NUXT_DISCORD_WEBHOOK_EXTRACT_URL", "https://discord.example/extract");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const event = fakeEvent();

    beginDiscordDigest(event);
    await sendDiscordAdminNotification("Queue Item Processed", "Added **3** roles", {
      event,
      queue: "wiki_extract",
    });
    await sendDiscordAdminNotification("Wikipedia Queue Error", "Boom", {
      event,
      queue: "wiki_extract",
      color: 0xed4245,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await flushDiscordDigest(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const embeds = readProperty(body, "embeds");
    if (!Array.isArray(embeds)) throw new Error("expected an embeds array");
    expect(readProperty(embeds[0], "title")).toBe("2 events — 1 error, 1 success");
    expect(readProperty(embeds[0], "color")).toBe(0xed4245);
    // Only the problem gets a detail embed.
    expect(embeds).toHaveLength(2);
  });

  it("sends a lone buffered notification in the regular single-embed format", () => {
    const [[embed, ...rest] = []] = buildDigestMessages([
      { title: "Queue event", message: "Details", options: { queue: "wiki_check" } },
    ]);
    expect(rest).toHaveLength(0);
    expect(embed?.title).toBe("[Check] Queue event");
  });

  it("collapses identical notifications into one counted row", () => {
    const entry = { title: "Wikipedia Queue Error", message: "Same", options: { color: 0xed4245 } };
    const [[summary] = []] = buildDigestMessages([entry, entry, entry]);
    expect(String(summary?.description)).toContain("×3");
    // One row = a subject line plus its "↳" outcome line.
    expect(String(summary?.description).split("\n")).toHaveLength(2);
  });

  it("splits overflow into follow-up messages that each respect Discord limits", () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      title: `Error ${i}`,
      message: `${"x".repeat(900)} ${i}`,
      options: { color: 0xed4245 },
    }));
    const messages = buildDigestMessages(entries);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.length).toBeLessThanOrEqual(4);
    for (const embeds of messages) {
      expect(embeds.length).toBeLessThanOrEqual(10);
      expect(embeds.reduce((sum, e) => sum + embedChars(e), 0)).toBeLessThanOrEqual(6000);
      expect(String(embeds[0]?.description).length).toBeLessThanOrEqual(4096);
    }
    expect(String(messages[0]?.[0]?.title)).toContain("(1/");
  });

  it("fills a message close to the character limit before splitting", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      title: `Error ${i}`,
      message: "y".repeat(1000) + i,
      options: { color: 0xed4245 },
    }));
    const [first] = buildDigestMessages(entries);
    const used = (first ?? []).reduce((sum, e) => sum + embedChars(e), 0);
    expect(used).toBeGreaterThan(5000);
    expect(used).toBeLessThanOrEqual(6000);
  });

  it("never drops events silently when the message cap is hit", () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({
      title: `Error ${i}`,
      message: "z".repeat(1400) + i,
      options: { color: 0xed4245 },
    }));
    const messages = buildDigestMessages(entries);
    expect(messages).toHaveLength(4);
    expect(String(messages[3]?.[0]?.description)).toMatch(/and \d+ more event\(s\)/);
  });

  it("sends immediately when no digest is open for the event", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example/general");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendDiscordAdminNotification("Now", "Details", { event: fakeEvent() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("folds bullet lines into one compact row", () => {
    expect(condenseMessage("Done\n• Added **3** roles\n• LLM: x", 100)).toBe(
      "Done · Added **3** roles · LLM: x",
    );
    expect(condenseMessage("a".repeat(50), 10)).toHaveLength(10);
  });

  it("renders a scannable row per event and labelled fields for failures", () => {
    const [[summary, detail] = []] = buildDigestMessages([
      {
        title: "Wikipedia Queue Error",
        message: "Media: **Alien** (movie, TMDB 348)\nQueue: wiki_scan\nError: 503",
        options: {
          color: 0xed4245,
          subject: "Alien",
          tag: "movie · FR",
          url: "https://fr.wikipedia.org/wiki/Alien",
          summary: "resolve page failed: 503",
          fields: errorFields("resolve page", "503"),
        },
      },
      {
        title: "Queue Item Processed [EN]",
        message: "long",
        options: { subject: "Dune", tag: "movie · EN", summary: "+42 roles · +9 actors" },
      },
    ]);
    expect(String(summary?.description)).toBe(
      "❌ [Alien](https://fr.wikipedia.org/wiki/Alien) · movie · FR\n  ↳ resolve page failed: 503\n" +
        "✅ **Dune** · movie · EN\n  ↳ +42 roles · +9 actors",
    );
    expect(detail?.fields).toEqual([
      { name: "Step", value: "resolve page", inline: true },
      { name: "Error", value: "```503```" },
    ]);
    expect(detail?.description).toBeUndefined();
  });

  it("does not repeat the raw text for a warning that already has a summary", () => {
    const [embeds = []] = buildDigestMessages([
      {
        title: "Archived",
        message: "x".repeat(600),
        options: { color: 0xfee75c, subject: "Oppenheimer", summary: "No candidate sections" },
      },
      { title: "Other", message: "ok", options: { subject: "Dune", summary: "fine" } },
    ]);
    expect(embeds).toHaveLength(1);
  });
});
