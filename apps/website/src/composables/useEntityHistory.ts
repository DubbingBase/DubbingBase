import { isRecord } from "@app/shared-logic";

export type HistoryEntityType = "voice_actor" | "studio";

export type HistoryChange = {
  field: string;
  before: string | null;
  after: string | null;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  contributor: string;
  target: "profile" | "cast_credit";
  label: string | null;
  changes: HistoryChange[];
};

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function parseChange(value: unknown): HistoryChange | null {
  if (!isRecord(value) || typeof value.field !== "string") return null;
  return {
    field: value.field,
    before: displayValue(value.before),
    after: displayValue(value.after),
  };
}

function parseEntry(value: unknown): HistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.contributor !== "string" ||
    !Array.isArray(value.changes)
  ) {
    return null;
  }
  const changes = value.changes.flatMap((change: unknown) => parseChange(change) ?? []);
  return {
    id: value.id,
    createdAt: value.createdAt,
    contributor: value.contributor,
    target: value.target === "cast_credit" ? "cast_credit" : "profile",
    label: typeof value.label === "string" ? value.label : null,
    changes,
  };
}

/**
 * Loads the public change history of a voice actor or studio. Loading is explicit so
 * collapsed history sections cost nothing until a visitor opens them.
 */
export function useEntityHistory(type: HistoryEntityType, id: () => string | number | undefined) {
  const entries = ref<HistoryEntry[]>([]);
  const isLoading = ref(false);
  const hasError = ref(false);
  const isLoaded = ref(false);

  async function load(): Promise<void> {
    const entityId = id();
    if (entityId === undefined || isLoading.value) return;
    isLoading.value = true;
    hasError.value = false;
    try {
      const response: unknown = await $fetch<unknown>("/api/entity-history", {
        query: { type, id: String(entityId) },
      });
      const rows = isRecord(response) && Array.isArray(response.entries) ? response.entries : [];
      entries.value = rows.flatMap((row: unknown) => parseEntry(row) ?? []);
      isLoaded.value = true;
    } catch {
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  return { entries, isLoading, hasError, isLoaded, load };
}
