import { describe, expect, it } from "vitest";
import { formatLegalDate } from "./legal-date";

describe("formatLegalDate", () => {
  it("formats as ISO date in UTC regardless of locale", () => {
    expect(formatLegalDate(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-13");
  });
});
