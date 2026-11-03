import { describe, expect, it } from "vitest";
import { localizePublishedContentLink, publishedContentLink } from "./published-content-link";

describe("published content notification links", () => {
  it.each([
    ["movie", 123, "https://dubbingbase.com/movie/123"],
    ["tv", 123, "https://dubbingbase.com/show/123"],
    ["video_game", 123, "https://dubbingbase.com/game/123"],
    ["audiobook", 123, "https://dubbingbase.com/audiobook/123"],
  ])("maps %s to its public HTTPS route", (contentType, contentId, expected) => {
    expect(publishedContentLink(contentType, contentId)).toBe(expected);
  });

  it("rejects unknown and invalid content identities", () => {
    expect(publishedContentLink("actor", 1)).toBeNull();
    expect(publishedContentLink("movie", 0)).toBeNull();
    expect(publishedContentLink("movie", -1)).toBeNull();
  });

  it.each(["en", "fr", "es", "ja"])("localizes a notification link for %s", (locale) => {
    const localized = localizePublishedContentLink("https://dubbingbase.com/movie/123", locale);
    expect(localized).toBe(
      locale === "en"
        ? "https://dubbingbase.com/movie/123"
        : `https://dubbingbase.com/${locale}/movie/123`,
    );
  });

  it("falls back to the default locale for unknown locales and rejects external links", () => {
    expect(localizePublishedContentLink("https://dubbingbase.com/movie/123", "unknown")).toBe(
      "https://dubbingbase.com/movie/123",
    );
    expect(localizePublishedContentLink("https://example.com/movie/123", "fr")).toBeNull();
  });
});
