import { isDubbingLanguage } from "@app/shared-logic";

export interface VoiceCastAssignmentRow {
  actor_id: number | null;
  voice_actor_id: number | null;
}

export function regionalLanguageFromQuery(value: unknown): string {
  return isDubbingLanguage(value) ? value : "";
}

export function canSaveRegionalAssignments(
  dubbingLanguage: unknown,
  isLoading: boolean,
  hasChanges: boolean,
): boolean {
  return isDubbingLanguage(dubbingLanguage) && !isLoading && hasChanges;
}

export function emptyAssignmentsForActors(
  actorIds: readonly number[],
): Record<number, null> {
  return Object.fromEntries(actorIds.map((actorId) => [actorId, null]));
}

export function assignmentsForActors(
  actorIds: readonly number[],
  rows: readonly VoiceCastAssignmentRow[],
): Record<number, number | null> {
  const assignments: Record<number, number | null> = {};
  for (const actorId of actorIds) {
    const row = rows.find((item) => item.actor_id === actorId);
    assignments[actorId] = row?.voice_actor_id ?? null;
  }
  return assignments;
}

export function isCurrentRegionalRequest(
  requestSequence: number,
  activeSequence: number,
): boolean {
  return requestSequence === activeSequence;
}

export function haveAssignmentsChanged(
  current: Record<number, number | null>,
  initial: Record<number, number | null>,
): boolean {
  const actorIds = new Set([
    ...Object.keys(current).map(Number),
    ...Object.keys(initial).map(Number),
  ]);
  return [...actorIds].some(
    (actorId) => (current[actorId] ?? null) !== (initial[actorId] ?? null),
  );
}
