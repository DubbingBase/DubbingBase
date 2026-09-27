import { describe, expect, it } from "vitest";
import {
  assignmentsForActors,
  canSaveRegionalAssignments,
  changedAssignmentOperations,
  emptyAssignmentsForActors,
  haveAssignmentsChanged,
  isCurrentRegionalRequest,
  regionalLanguageFromQuery,
} from "./voice-cast-assignments";

describe("regional voice cast assignments", () => {
  const actorIds = [101];

  it("keeps assignments separate when the selected region changes", () => {
    const france = assignmentsForActors(actorIds, [
      { actor_id: 101, work_id: 301, voice_actor_id: 201, editable: true },
      { actor_id: 202, work_id: 302, voice_actor_id: 299, editable: true },
    ]);
    const canada = assignmentsForActors(actorIds, [
      { actor_id: 101, work_id: 401, voice_actor_id: 301, editable: true },
    ]);

    expect(france[101]).toEqual({
      work_id: 301,
      voice_actor_id: 201,
      editable: true,
    });
    expect(canada[101]).toEqual({
      work_id: 401,
      voice_actor_id: 301,
      editable: true,
    });
    expect(haveAssignmentsChanged(canada, france)).toBe(true);
  });

  it("starts empty when there is no project for the selected region", () => {
    const assignments = assignmentsForActors(actorIds, []);

    expect(assignments[101]).toEqual({
      work_id: null,
      voice_actor_id: null,
      editable: true,
    });
    expect(haveAssignmentsChanged(assignments, { ...assignments })).toBe(false);
  });

  it("clears the previous region before loading the next one", () => {
    const france = assignmentsForActors(actorIds, [
      { actor_id: 101, work_id: 301, voice_actor_id: 201, editable: true },
    ]);

    expect(emptyAssignmentsForActors(actorIds)[101]).toEqual({
      work_id: null,
      voice_actor_id: null,
      editable: true,
    });
    expect(france[101].work_id).toBe(301);
    expect(france[101].voice_actor_id).toBe(201);
  });

  it("accepts only registered regional route query values", () => {
    expect(regionalLanguageFromQuery("fr-FR")).toBe("fr-FR");
    expect(regionalLanguageFromQuery("fr")).toBe("");
    expect(regionalLanguageFromQuery("FR-fr")).toBe("");
    expect(regionalLanguageFromQuery(undefined)).toBe("");
  });

  it("allows saving only with a valid selected region and loaded changes", () => {
    expect(canSaveRegionalAssignments("", false, true)).toBe(false);
    expect(canSaveRegionalAssignments("fr", false, true)).toBe(false);
    expect(canSaveRegionalAssignments("fr-FR", true, true)).toBe(false);
    expect(canSaveRegionalAssignments("fr-FR", false, false)).toBe(false);
    expect(canSaveRegionalAssignments("fr-FR", false, true)).toBe(true);
  });

  it("does not apply a response from an earlier region request", () => {
    expect(isCurrentRegionalRequest(3, 4)).toBe(false);
    expect(isCurrentRegionalRequest(4, 4)).toBe(true);
  });

  it("refuses to model multiple works for one actor as one editable assignment", () => {
    const assignments = assignmentsForActors(actorIds, [
      { actor_id: 101, work_id: 301, voice_actor_id: 201, editable: false },
      { actor_id: 101, work_id: 302, voice_actor_id: 202, editable: false },
    ]);

    expect(assignments[101]).toEqual({
      work_id: null,
      voice_actor_id: null,
      editable: false,
    });
    expect(
      changedAssignmentOperations(
        { 101: { ...assignments[101], voice_actor_id: 999 } },
        assignments,
      ),
    ).toEqual([]);
  });

  it("emits exact work IDs for updates and clears, and null only for inserts", () => {
    const initial = {
      101: { work_id: 301, voice_actor_id: 201, editable: true },
      102: { work_id: 302, voice_actor_id: 202, editable: true },
      103: { work_id: null, voice_actor_id: null, editable: true },
    };
    const current = {
      101: { ...initial[101], voice_actor_id: 999 },
      102: { ...initial[102], voice_actor_id: null },
      103: { ...initial[103], voice_actor_id: 303 },
    };

    expect(changedAssignmentOperations(current, initial)).toEqual([
      { actor_id: 101, work_id: 301, voice_actor_id: 999 },
      { actor_id: 102, work_id: 302, voice_actor_id: null },
      { actor_id: 103, work_id: null, voice_actor_id: 303 },
    ]);
  });
});
