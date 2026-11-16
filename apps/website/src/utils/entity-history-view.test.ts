import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../composables/useEntityHistory";
import {
  countByFilter,
  dayDifference,
  filterEntries,
  formatRelativeTime,
  groupByDay,
  isSafeHref,
} from "./entity-history-view";

function entry(id: string, createdAt: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    createdAt,
    action: "update",
    contributor: "Ann",
    kind: "edited",
    important: false,
    target: "profile",
    label: null,
    href: null,
    reverted: false,
    revertable: false,
    revertBlockedReason: null,
    changes: [],
    ...overrides,
  };
}

const entries = [
  entry("a", "2026-05-02T12:00:00", { important: true }),
  entry("b", "2026-05-02T08:00:00", { target: "cast_credit", label: "Hero" }),
  entry("c", "2026-05-01T12:00:00", { target: "cast_credit", important: true }),
];

describe("entity history view", () => {
  it("groups entries by local day, preserving order", () => {
    const groups = groupByDay(entries);
    expect(groups.map((g) => [g.key, g.entries.map((e) => e.id)])).toEqual([
      ["2026-05-02", ["a", "b"]],
      ["2026-05-01", ["c"]],
    ]);
  });

  it("filters by chip", () => {
    expect(filterEntries(entries, "all")).toHaveLength(3);
    expect(filterEntries(entries, "important").map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterEntries(entries, "cast_credit").map((e) => e.id)).toEqual(["b", "c"]);
    expect(filterEntries(entries, "profile").map((e) => e.id)).toEqual(["a"]);
  });

  it("counts every filter", () => {
    expect(countByFilter(entries)).toEqual({ all: 3, important: 2, cast_credit: 2, profile: 1 });
  });

  it("accepts only https and site-relative hrefs", () => {
    expect(isSafeHref("https://example.com/a")).toBe(true);
    expect(isSafeHref("/movie/1")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("http://example.com")).toBe(false);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeHref(null)).toBe(false);
  });

  it("computes day differences and relative time", () => {
    const now = new Date("2026-05-02T12:00:00");
    expect(dayDifference(new Date("2026-05-01T23:00:00"), now)).toBe(1);
    expect(formatRelativeTime("2026-05-02T09:00:00", "en", now)).toBe("3 hours ago");
  });
});
