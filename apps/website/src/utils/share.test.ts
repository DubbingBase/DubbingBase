import { describe, expect, it, vi } from "vitest";
import { buildShareUrl, shareUrl } from "./share";

const siteUrl = "https://dubbingbase.com";

describe("buildShareUrl", () => {
  it("keeps locale path and a valid dub, dropping hash and unrelated query", () => {
    expect(buildShareUrl({ siteUrl, path: "/fr/movie/12", dub: 5 })).toBe(
      "https://dubbingbase.com/fr/movie/12?dub=5",
    );
  });
  it("supports the original version", () => {
    expect(buildShareUrl({ siteUrl, path: "/show/1", dub: "original" })).toBe(
      "https://dubbingbase.com/show/1?dub=original",
    );
  });
  it("omits missing, null and invalid dub values", () => {
    for (const dub of [undefined, null, 0, -1, Number.NaN, 1.5]) {
      expect(buildShareUrl({ siteUrl, path: "/movie/1", dub })).toBe(
        "https://dubbingbase.com/movie/1",
      );
    }
  });
  it("keeps only required entity query parameters", () => {
    expect(
      buildShareUrl({
        siteUrl,
        path: "/character/tvdb/9",
        keepQuery: { mediaType: "tv", mediaId: "3", utm: undefined },
      }),
    ).toBe("https://dubbingbase.com/character/tvdb/9?mediaType=tv&mediaId=3");
  });
});

describe("shareUrl", () => {
  const abort = () => new DOMException("cancelled", "AbortError");
  it("uses native share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareUrl("T", "u", { share })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "T", url: "u" });
  });
  it("treats cancellation as a no-op without copying", async () => {
    const writeText = vi.fn();
    const outcome = await shareUrl("T", "u", {
      share: () => Promise.reject(abort()),
      writeText,
    });
    expect(outcome).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("copies when share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareUrl("T", "u", { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("u");
  });
  it("copies when native share fails for another reason", async () => {
    const outcome = await shareUrl("T", "u", {
      share: () => Promise.reject(new Error("boom")),
      writeText: () => Promise.resolve(),
    });
    expect(outcome).toBe("copied");
  });
  it("falls back to manual copy when clipboard fails or is missing", async () => {
    expect(await shareUrl("T", "u", { writeText: () => Promise.reject(new Error("x")) })).toBe(
      "manual",
    );
    expect(await shareUrl("T", "u", {})).toBe("manual");
  });
});
