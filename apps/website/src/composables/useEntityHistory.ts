import { isRecord, readProperty } from "@app/shared-logic";

export type HistoryEntityType = "voice_actor" | "studio";

export type HistoryKind = "created" | "edited" | "deleted" | "verification";
export type HistoryChangeType = "text" | "image" | "link" | "status";

export type HistoryChange = {
  field: string;
  importance: "high" | "normal";
  type: HistoryChangeType;
  /** Display strings from the server; null means the value is empty. */
  before: string | null;
  after: string | null;
  beforeHref: string | null;
  afterHref: string | null;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  action: string;
  contributor: string;
  kind: HistoryKind;
  important: boolean;
  target: "profile" | "cast_credit";
  label: string | null;
  href: string | null;
  reverted: boolean;
  revertable: boolean;
  revertBlockedReason: "changed_since" | "unsupported" | null;
  changes: HistoryChange[];
};

/** Shape of the history response before each entry is validated. */
type HistoryWire = { canRevert: boolean; entries: unknown[] };

export type RevertFailure = "changed" | "unsupported" | "forbidden" | "notFound" | "other";

export type RevertResult =
  | { ok: true }
  | { ok: false; reason: RevertFailure; message: string | null };

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseKind(value: unknown): HistoryKind {
  if (value === "created" || value === "deleted" || value === "verification") return value;
  return "edited";
}

function parseChangeType(value: unknown): HistoryChangeType {
  if (value === "image" || value === "link" || value === "status") return value;
  return "text";
}

function parseChange(value: unknown): HistoryChange | null {
  if (!isRecord(value) || typeof value.field !== "string") return null;
  const before = stringOrNull(value.before);
  const after = stringOrNull(value.after);
  return {
    field: value.field,
    importance: value.importance === "high" ? "high" : "normal",
    type: parseChangeType(value.type),
    before,
    after,
    beforeHref: stringOrNull(value.beforeHref),
    afterHref: stringOrNull(value.afterHref),
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
    action: typeof value.action === "string" ? value.action : "",
    contributor: value.contributor,
    kind: parseKind(value.kind),
    important: value.important === true,
    target: value.target === "cast_credit" ? "cast_credit" : "profile",
    label: stringOrNull(value.label),
    href: stringOrNull(value.href),
    reverted: value.reverted === true,
    revertable: value.revertable === true,
    revertBlockedReason:
      value.revertBlockedReason === "changed_since" || value.revertBlockedReason === "unsupported"
        ? value.revertBlockedReason
        : null,
    changes,
  };
}

function errorStatus(error: unknown): number | null {
  const status = readProperty(error, "statusCode") ?? readProperty(error, "status");
  return typeof status === "number" ? status : null;
}

function errorMessage(error: unknown): string | null {
  const data = readProperty(error, "data");
  const candidates = [
    readProperty(data, "statusMessage"),
    readProperty(data, "message"),
    readProperty(error, "statusMessage"),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

/**
 * Loads the public change history of a voice actor or studio, and lets admins revert an
 * entry. Loading is explicit so a closed history dialog costs nothing until it is opened.
 */
export function useEntityHistory(type: HistoryEntityType, id: () => string | number | undefined) {
  const entries = ref<HistoryEntry[]>([]);
  const canRevert = ref(false);
  const isLoading = ref(false);
  const hasError = ref(false);
  const isLoaded = ref(false);

  async function load(): Promise<void> {
    const entityId = id();
    if (entityId === undefined || isLoading.value) return;
    isLoading.value = true;
    hasError.value = false;
    try {
      const response = await $fetch<HistoryWire>("/api/entity-history", {
        query: { type, id: String(entityId) },
      });
      entries.value = response.entries.flatMap((row: unknown) => parseEntry(row) ?? []);
      canRevert.value = response.canRevert === true;
      isLoaded.value = true;
    } catch {
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  async function revert(auditLogId: string): Promise<RevertResult> {
    try {
      await $fetch<{ success: boolean }>("/api/revert-history-entry", {
        method: "POST",
        body: { audit_log_id: auditLogId },
      });
      return { ok: true };
    } catch (error: unknown) {
      const status = errorStatus(error);
      const message = errorMessage(error);
      if (status === 409) return { ok: false, reason: "changed", message };
      if (status === 422) return { ok: false, reason: "unsupported", message };
      if (status === 403) return { ok: false, reason: "forbidden", message };
      if (status === 404) return { ok: false, reason: "notFound", message };
      return { ok: false, reason: "other", message };
    }
  }

  return { entries, canRevert, isLoading, hasError, isLoaded, load, revert };
}
