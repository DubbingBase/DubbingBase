import type { HistoryEntry } from "../composables/useEntityHistory";

export type HistoryFilter = "all" | "important" | "cast_credit" | "profile";

export type HistoryDayGroup = {
  /** Local calendar day, `YYYY-MM-DD`. */
  key: string;
  /** Representative date for the heading (first entry of the day). */
  date: Date;
  entries: HistoryEntry[];
};

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  "all",
  "important",
  "cast_credit",
  "profile",
];

/** Only same-site paths and https URLs may be rendered as links. */
export function isSafeHref(href: string | null | undefined): href is string {
  if (typeof href !== "string") return false;
  if (href.startsWith("//")) return false;
  return href.startsWith("https://") || href.startsWith("/");
}

export function matchesFilter(entry: HistoryEntry, filter: HistoryFilter): boolean {
  if (filter === "important") return entry.important;
  if (filter === "cast_credit") return entry.target === "cast_credit";
  if (filter === "profile") return entry.target === "profile";
  return true;
}

export function filterEntries(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  return entries.filter((entry) => matchesFilter(entry, filter));
}

export function countByFilter(entries: HistoryEntry[]): Record<HistoryFilter, number> {
  return {
    all: entries.length,
    important: filterEntries(entries, "important").length,
    cast_credit: filterEntries(entries, "cast_credit").length,
    profile: filterEntries(entries, "profile").length,
  };
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Groups entries (kept in their given order) under local calendar days. */
export function groupByDay(entries: HistoryEntry[]): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      continue;
    }
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.entries.push(entry);
    else groups.push({ key, date, entries: [entry] });
  }
  return groups;
}

/** Whole calendar days between `date` and `now` (0 = today, 1 = yesterday). */
export function dayDifference(date: Date, now: Date): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86_400_000);
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "3 hours ago" style text; falls back to seconds for very recent timestamps. */
export function formatRelativeTime(value: string, locale: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absolute = Math.abs(seconds);
  for (const [unit, size] of RELATIVE_UNITS) {
    if (absolute >= size) return formatter.format(Math.trunc(seconds / size), unit);
  }
  return formatter.format(Math.trunc(seconds), "second");
}
