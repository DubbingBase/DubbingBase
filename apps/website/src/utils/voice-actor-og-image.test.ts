import { describe, expect, it } from "vitest";
import { getVoiceActorOgImageMetadata, isVoiceActorOgImagesEnabled } from "./voice-actor-og-image";

const siteUrl = "https://example.com";

describe("voice actor OG image metadata", () => {
  it.each([
    [false, false],
    ["false", false],
    [true, true],
    ["true", true],
  ])("normalizes runtime enabled value %s", (value, enabled) => {
    expect(isVoiceActorOgImagesEnabled(value)).toBe(enabled);
  });

  it("uses the square static preview and summary card while disabled", () => {
    const metadata = getVoiceActorOgImageMetadata(false, 42, siteUrl);

    expect(metadata).toEqual({
      url: "https://example.com/android-chrome-512x512.png",
      width: 512,
      height: 512,
      twitterCard: "summary",
    });
    expect(metadata.url).not.toContain("/api/og-image");
  });

  it("restores actor-specific metadata when enabled", () => {
    expect(getVoiceActorOgImageMetadata(true, 42, siteUrl)).toEqual({
      url: "https://example.com/api/og-image?type=voice-actor&id=42",
      width: 1200,
      height: 630,
      twitterCard: "summary_large_image",
    });
  });

  it("keeps invalid actor IDs on the static preview", () => {
    expect(getVoiceActorOgImageMetadata(true, 0, siteUrl).url).toBe(
      "https://example.com/android-chrome-512x512.png",
    );
    expect(getVoiceActorOgImageMetadata(true, Number.MAX_SAFE_INTEGER + 1, siteUrl).url).toBe(
      "https://example.com/android-chrome-512x512.png",
    );
  });
});
