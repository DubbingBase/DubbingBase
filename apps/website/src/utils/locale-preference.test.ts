import { describe, expect, it } from "vitest";
import { resolvePreferredLocale } from "./locale-preference";

describe("resolvePreferredLocale", () => {
  it("prefers an explicit saved choice over the browser language", () => {
    expect(resolvePreferredLocale("en", ["fr-FR"])).toBe("en");
  });

  it("falls back to the first supported browser language", () => {
    expect(resolvePreferredLocale(undefined, ["de-DE", "ja", "fr"])).toBe("ja");
    expect(resolvePreferredLocale(null, ["fr_CA"])).toBe("fr");
  });

  it("ignores unsupported values", () => {
    expect(resolvePreferredLocale("xx", ["de-DE"])).toBeNull();
    expect(resolvePreferredLocale(undefined, [])).toBeNull();
  });
});
