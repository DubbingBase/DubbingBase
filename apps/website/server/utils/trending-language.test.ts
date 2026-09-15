import { describe, expect, it } from "vitest";
import { resolveLocaleLanguage } from "@app/shared-logic";

describe("resolveLocaleLanguage", () => {
  it.each([
    ["en", "en-US"],
    ["fr", "fr-FR"],
    ["es", "es-ES"],
    ["ja", "ja-JP"],
    ["en-US", "en-US"],
    ["fr-FR", "fr-FR"],
    ["es-ES", "es-ES"],
    ["ja-JP", "ja-JP"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(resolveLocaleLanguage(input)).toBe(expected);
  });

  it("defaults a missing value to the default application language", () => {
    expect(resolveLocaleLanguage()).toBe("en-US");
  });

  it("rejects unsupported languages", () => {
    expect(resolveLocaleLanguage("de-DE")).toBeNull();
  });
});
