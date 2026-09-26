import { describe, expect, it } from "vitest";
import {
  assignmentsForActors,
  canSaveRegionalAssignments,
  emptyAssignmentsForActors,
  haveAssignmentsChanged,
  isCurrentRegionalRequest,
  regionalLanguageFromQuery,
} from "./voice-cast-assignments";

describe("regional voice cast assignments", () => {
  const actorIds = [101];

  it("keeps assignments separate when the selected region changes", () => {
    const france = assignmentsForActors(actorIds, [
      { actor_id: 101, voice_actor_id: 201 },
      { actor_id: 202, voice_actor_id: 299 },
    ]);
    const canada = assignmentsForActors(actorIds, [
      { actor_id: 101, voice_actor_id: 301 },
    ]);

    expect(france).toEqual({ 101: 201 });
    expect(canada).toEqual({ 101: 301 });
    expect(haveAssignmentsChanged(canada, france)).toBe(true);
  });

  it("starts empty when there is no project for the selected region", () => {
    const assignments = assignmentsForActors(actorIds, []);

    expect(assignments).toEqual({ 101: null });
    expect(haveAssignmentsChanged(assignments, { ...assignments })).toBe(false);
  });

  it("clears the previous region before loading the next one", () => {
    const france = assignmentsForActors(actorIds, [
      { actor_id: 101, voice_actor_id: 201 },
    ]);

    expect(emptyAssignmentsForActors(actorIds)).toEqual({ 101: null });
    expect(france).toEqual({ 101: 201 });
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
});
