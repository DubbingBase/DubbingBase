import { isDubbingLanguage } from "@app/shared-logic";

export interface VoiceCastAssignmentRow {
  actor_id: number | null;
  work_id: number;
  voice_actor_id: number | null;
  editable: boolean;
}

export interface VoiceCastAssignment {
  work_id: number | null;
  voice_actor_id: number | null;
  editable: boolean;
}

export interface VoiceCastAssignmentOperation {
  actor_id: number;
  work_id: number | null;
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
): Record<number, VoiceCastAssignment> {
  return Object.fromEntries(
    actorIds.map((actorId) => [actorId, { work_id: null, voice_actor_id: null, editable: true }]),
  );
}

export function assignmentsForActors(
  actorIds: readonly number[],
  rows: readonly VoiceCastAssignmentRow[],
): Record<number, VoiceCastAssignment> {
  const assignments: Record<number, VoiceCastAssignment> = {};
  for (const actorId of actorIds) {
    const actorRows = rows.filter((item) => item.actor_id === actorId);
    if (actorRows.length > 1) {
      assignments[actorId] = {
        work_id: null,
        voice_actor_id: null,
        editable: false,
      };
      continue;
    }

    const row = actorRows[0];
    assignments[actorId] = row
      ? {
          work_id: row.work_id,
          voice_actor_id: row.voice_actor_id,
          editable: row.editable,
        }
      : { work_id: null, voice_actor_id: null, editable: true };
  }
  return assignments;
}

export function isCurrentRegionalRequest(requestSequence: number, activeSequence: number): boolean {
  return requestSequence === activeSequence;
}

export function haveAssignmentsChanged(
  current: Record<number, VoiceCastAssignment>,
  initial: Record<number, VoiceCastAssignment>,
): boolean {
  const actorIds = new Set([
    ...Object.keys(current).map(Number),
    ...Object.keys(initial).map(Number),
  ]);
  return [...actorIds].some(
    (actorId) =>
      current[actorId]?.editable !== false &&
      initial[actorId]?.editable !== false &&
      (current[actorId]?.voice_actor_id ?? null) !== (initial[actorId]?.voice_actor_id ?? null),
  );
}

export function changedAssignmentOperations(
  current: Record<number, VoiceCastAssignment>,
  initial: Record<number, VoiceCastAssignment>,
): VoiceCastAssignmentOperation[] {
  return Object.entries(current)
    .filter(([actorId, assignment]) => {
      const previous = initial[Number(actorId)];
      return (
        assignment.editable &&
        previous?.editable !== false &&
        (assignment.voice_actor_id ?? null) !== (previous?.voice_actor_id ?? null)
      );
    })
    .map(([actorId, assignment]) => ({
      actor_id: Number(actorId),
      work_id: assignment.work_id,
      voice_actor_id: assignment.voice_actor_id,
    }));
}
