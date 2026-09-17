import { describe, expect, it } from "vitest";
import {
  prefillDuplicateWork,
  rankDuplicateWorks,
  type DuplicateWorkEntry,
} from "./duplicate-work";

const work = (
  id: number,
  overrides: Partial<DuplicateWorkEntry> = {},
): DuplicateWorkEntry => ({
  id,
  dubbing_project_id: 5,
  actor_id: 7,
  character_id: null,
  voice_actor_id: 11,
  character_name: null,
  performance: null,
  status: null,
  reviewed_status: null,
  note: null,
  highlight: null,
  source_id: null,
  sourceName: null,
  suggestions: null,
  created_at: null,
  created_by: null,
  updated_at: null,
  updated_by: null,
  voteCount: 0,
  upVotes: 0,
  downVotes: 0,
  voiceActor: null,
  ...overrides,
});

describe("duplicate work comparison", () => {
  it("ranks reviewed and complete records before newer or lower-id records", () => {
    expect(
      rankDuplicateWorks([
        work(1, { updated_at: "2026-09-01T00:00:00Z" }),
        work(3, { reviewed_status: "accepted" }),
        work(2, { performance: "voice", note: "credits" }),
      ]).map(({ id }) => id),
    ).toEqual([3, 2, 1]);
  });

  it("fills empty values by source strength and keeps false as a real value", () => {
    const canonical = work(8, {
      reviewed_status: "accepted",
      highlight: false,
    });
    const donor = work(9, {
      status: "validated",
      highlight: true,
      performance: "dialogues",
      source_id: 14,
      sourceName: "Credits page",
    });

    const result = prefillDuplicateWork(canonical, [canonical, donor]);

    expect(result.values).toMatchObject({
      highlight: false,
      status: "validated",
      performance: "dialogues",
      source_id: 14,
    });
    expect(result.provenance.performance).toBe(9);
    expect(result.provenance.highlight).toBe(8);
  });
});
