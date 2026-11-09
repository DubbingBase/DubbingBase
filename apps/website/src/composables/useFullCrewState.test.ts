import { describe, expect, it } from "vitest";
import { useFullCrewState as createCrew } from "./useFullCrewState";

const useFullCrewState = () => createCrew((key) => key);

describe("useFullCrewState", () => {
  it("maps crew rows to roles and back to save rows", () => {
    const crew = useFullCrewState();
    crew.load([
      { job_id: 1, person_id: 10 },
      { job_id: 5, person_id: 50 },
    ]);

    expect(crew.values.value).toMatchObject({ artisticDirector: 10, mixing: 50, editing: null });
    expect(crew.toSaveRows()).toEqual([
      { job_id: 1, person_id: 10 },
      { job_id: 5, person_id: 50 },
    ]);
  });

  it("clears roles missing from a reloaded crew", () => {
    const crew = useFullCrewState();
    crew.load([{ job_id: 2, person_id: 20 }]);
    crew.load([{ job_id: 3, person_id: 30 }]);

    expect(crew.values.value).toMatchObject({ adaptation: null, recording: 30 });
  });

  it("ignores unknown keys and round-trips snapshots", () => {
    const crew = useFullCrewState();
    crew.set("mixing", 7);
    crew.set("unknown", 9);
    const saved = crew.snapshot();
    crew.load([]);
    crew.restore(saved);

    expect(crew.values.value).toMatchObject({ mixing: 7 });
  });
});
