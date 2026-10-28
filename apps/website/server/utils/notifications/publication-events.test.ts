import { describe, expect, it } from "vitest";
import {
  isNewlyValidatedWork,
  projectPublicationActorIds,
} from "./publication-events";

describe("publication notification eligibility", () => {
  it("includes new validated work but excludes corrections and unvalidated work", () => {
    expect(isNewlyValidatedWork(null, { status: "validated" })).toBe(true);
    expect(isNewlyValidatedWork({ status: "user" }, { status: "validated" })).toBe(true);
    expect(isNewlyValidatedWork({ status: "validated" }, { status: "validated" })).toBe(false);
    expect(isNewlyValidatedWork({ status: "draft" }, { status: "pending" })).toBe(false);
  });

  it("deduplicates actors for first publication and new validated cast rows only", () => {
    expect(
      projectPublicationActorIds(
        { project: { status: "draft" }, cast: [] },
        {
          project: { status: "validated" },
          cast: [
            { id: 1, voice_actor_id: 10, status: "validated" },
            { id: 2, voice_actor_id: 10, status: "validated" },
            { id: 3, voice_actor_id: 20, status: "user" },
          ],
        },
      ),
    ).toEqual([10]);

    expect(
      projectPublicationActorIds(
        {
          project: { status: "validated" },
          cast: [{ id: 1, voice_actor_id: 10, status: "validated" }],
        },
        {
          project: { status: "validated" },
          cast: [
            { id: 1, voice_actor_id: 10, status: "validated" },
            { id: 2, voice_actor_id: 10, status: "validated" },
            { id: 3, voice_actor_id: 20, status: "validated" },
          ],
        },
      ),
    ).toEqual([10, 20]);
  });

  it("does not notify draft or pending project saves", () => {
    expect(
      projectPublicationActorIds(
        { project: { status: "draft" }, cast: [] },
        {
          project: { status: "pending" },
          cast: [{ id: 1, voice_actor_id: 10, status: "validated" }],
        },
      ),
    ).toEqual([]);
  });
});
