import type { Json } from "@app/supabase";
import { isJson, isRecord } from "@app/shared-logic";
import { changedFields, type ChangedField } from "./entity-history";

export type RevertBlockReason = "changed_since" | "unsupported" | "already_reverted";

export type RevertPlan =
  | { kind: "voice_actor"; id: number; expectedUpdatedAt: string; updates: Record<string, Json> }
  | { kind: "studio"; id: number; expectedUpdatedAt: string; updates: Record<string, Json> }
  | { kind: "work_delete"; id: number; expectedUpdatedAt: string }
  | {
      kind: "work_update";
      id: number;
      expectedUpdatedAt: string;
      /** Previous performance to restore, or null when the entry did not change it. */
      performance: string | null;
      /** Review status every work_update ends with, so a revert never leaves a credit verified. */
      reviewedStatus: string;
    };

export type RevertEvaluation =
  | { ok: true; plan: RevertPlan }
  | { ok: false; reason: RevertBlockReason };

export type RevertSubject = {
  entity_type: string;
  entity_id: string;
  previous_value: unknown;
  new_value: unknown;
  reverted_at?: string | null;
};

function blocked(reason: RevertBlockReason): RevertEvaluation {
  return { ok: false, reason };
}

function sameJson(left: Json, right: Json): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readJson(source: Record<string, unknown>, field: string): Json {
  const value = source[field];
  return isJson(value) ? value : null;
}

function positiveId(value: string): number | null {
  return /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null;
}

function readUpdatedAt(current: Record<string, unknown>): string | null {
  const value = current.updated_at;
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Every changed field must still hold the value this entry wrote; otherwise a later edit exists. */
function stillHoldsAfterValues(current: Record<string, unknown>, changes: ChangedField[]): boolean {
  return changes.every((change) => sameJson(readJson(current, change.field), change.after));
}

/** Studio social links are patched by platform, so removing a platform means sending null. */
function studioPatchValue(change: ChangedField): Json | undefined {
  if (change.field !== "social_media_links") return change.before;
  const before = isRecord(change.before) ? change.before : {};
  const after = isRecord(change.after) ? change.after : {};
  const patch: Record<string, Json> = {};
  for (const platform of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = before[platform];
    patch[platform] = isJson(previous) ? previous : null;
  }
  return patch;
}

function evaluateVoiceActor(
  subject: RevertSubject,
  current: Record<string, unknown>,
): RevertEvaluation {
  const id = positiveId(subject.entity_id);
  const expectedUpdatedAt = readUpdatedAt(current);
  if (id === null || expectedUpdatedAt === null) return blocked("unsupported");
  if (!isRecord(subject.previous_value) || !isRecord(subject.new_value))
    return blocked("unsupported");
  const changes = changedFields("profile", subject.previous_value, subject.new_value);
  if (changes.length === 0) return blocked("unsupported");
  if (!stillHoldsAfterValues(current, changes)) return blocked("changed_since");
  const updates: Record<string, Json> = {};
  for (const change of changes) updates[change.field] = change.before;
  return { ok: true, plan: { kind: "voice_actor", id, expectedUpdatedAt, updates } };
}

function evaluateStudio(
  subject: RevertSubject,
  current: Record<string, unknown>,
): RevertEvaluation {
  const id = positiveId(subject.entity_id);
  const expectedUpdatedAt = readUpdatedAt(current);
  if (id === null || expectedUpdatedAt === null) return blocked("unsupported");
  if (!isRecord(subject.previous_value) || !isRecord(subject.new_value))
    return blocked("unsupported");
  const changes = changedFields("studio", subject.previous_value, subject.new_value);
  if (changes.length === 0) return blocked("unsupported");
  if (changes.some((change) => change.field === "name" && typeof change.before !== "string")) {
    return blocked("unsupported");
  }
  if (!stillHoldsAfterValues(current, changes)) return blocked("changed_since");
  const updates: Record<string, Json> = {};
  for (const change of changes) {
    const value = studioPatchValue(change);
    if (value !== undefined) updates[change.field] = value;
  }
  return { ok: true, plan: { kind: "studio", id, expectedUpdatedAt, updates } };
}

function evaluateWork(
  subject: RevertSubject,
  current: Record<string, unknown> | null,
): RevertEvaluation {
  const id = positiveId(subject.entity_id);
  if (id === null || current === null) return blocked("unsupported");
  const expectedUpdatedAt = readUpdatedAt(current);
  if (expectedUpdatedAt === null) return blocked("unsupported");

  if (!isRecord(subject.previous_value) && isRecord(subject.new_value)) {
    return { ok: true, plan: { kind: "work_delete", id, expectedUpdatedAt } };
  }
  if (!isRecord(subject.previous_value) || !isRecord(subject.new_value))
    return blocked("unsupported");

  const changes = changedFields("work", subject.previous_value, subject.new_value);
  if (changes.length === 0) return blocked("unsupported");
  // Reassigning a credit to another voice actor or renaming its role is an admin save with
  // relationship side effects, so it is not reverted from here.
  if (
    changes.some((change) => change.field !== "performance" && change.field !== "reviewed_status")
  ) {
    return blocked("unsupported");
  }
  if (!stillHoldsAfterValues(current, changes)) return blocked("changed_since");

  const previousStatus = readJson(subject.previous_value, "reviewed_status");
  if (typeof previousStatus !== "string") return blocked("unsupported");
  const performanceChange = changes.find((change) => change.field === "performance");
  if (performanceChange && typeof performanceChange.before !== "string")
    return blocked("unsupported");
  return {
    ok: true,
    plan: {
      kind: "work_update",
      id,
      expectedUpdatedAt,
      performance:
        performanceChange && typeof performanceChange.before === "string"
          ? performanceChange.before
          : null,
      reviewedStatus: previousStatus,
    },
  };
}

/** Decides whether an audit entry can still be reverted, and exactly what to write. */
export function evaluateRevert(
  subject: RevertSubject,
  current: Record<string, unknown> | null,
): RevertEvaluation {
  if (subject.reverted_at !== null && subject.reverted_at !== undefined) {
    return blocked("already_reverted");
  }
  if (current === null && subject.entity_type !== "work") return blocked("unsupported");
  switch (subject.entity_type) {
    case "voice_actor":
    case "voice_actors":
      return current ? evaluateVoiceActor(subject, current) : blocked("unsupported");
    case "studio":
    case "studios":
      return current ? evaluateStudio(subject, current) : blocked("unsupported");
    case "work":
      return evaluateWork(subject, current);
    default:
      return blocked("unsupported");
  }
}
