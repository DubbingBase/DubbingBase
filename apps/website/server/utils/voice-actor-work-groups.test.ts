import { describe, expect, it } from "vitest";
import {
  groupVoiceActorWorks,
  paginateVoiceActorWorks,
  type VoiceActorWorkLike,
} from "@app/shared-logic";

type TestWork = VoiceActorWorkLike & { label: string };

function work(
  label: string,
  actorId?: number | null,
  actorName?: string,
  dataActorId?: number | null,
): TestWork {
  return {
    label,
    work: { actor_id: actorId },
    data: {
      actor: {
        id: dataActorId,
        name: actorName,
        profile_picture: `${label}.jpg`,
      },
    },
  };
}

describe("groupVoiceActorWorks", () => {
  it("keeps all works for one actor in one group, including more than 12", () => {
    const works = Array.from({ length: 13 }, (_, index) =>
      work(`work-${index + 1}`, 42, "Harrison Ford", 42),
    );

    const groups = groupVoiceActorWorks(works);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "actor:42",
      actorId: 42,
      worksCount: 13,
    });
    expect(groups[0]?.works).toEqual(works);
  });

  it("keeps actors with the same name but different IDs separate", () => {
    const groups = groupVoiceActorWorks([
      work("first", 12, "Alex Lee", 12),
      work("second", 34, "Alex Lee", 34),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["actor:12", "actor:34"]);
    expect(groups.map((group) => group.worksCount)).toEqual([1, 1]);
  });

  it("uses actor ID when display names differ and falls back to data actor ID", () => {
    const groups = groupVoiceActorWorks([
      work("first", 12, "Alex Lee", 12),
      work("second", 12, "Alexander Lee", 12),
      work("fallback-null", null, "Alex Lee", 12),
      work("fallback-zero", 0, "Alex Lee", 12),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.worksCount).toBe(4);
    expect(groups[0]?.actorId).toBe(12);
  });

  it("keeps unresolved works together without claiming actor identity", () => {
    const unresolvedWorks = [
      work("missing", null, "Unverified Actor One"),
      work("zero-primary", 0, "Unverified Actor Two", 0),
      work("negative", -1, "Unverified Actor Three", -1),
    ];
    const groups = groupVoiceActorWorks(unresolvedWorks);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "actor:unknown",
      actorId: null,
      actor: {
        id: null,
        name: null,
        profile_picture: null,
      },
      worksCount: 3,
    });
    expect(groups[0]?.works).toEqual(unresolvedWorks);
  });

  it("sorts groups by full counts, then actor name, with unknown last on a tie", () => {
    const works = [
      work("zulu-one", 20, "Zulu", 20),
      work("unknown", null),
      work("beta-one", 30, "Beta", 30),
      work("zulu-two", 20, "Zulu", 20),
      work("alpha-one", 10, "Alpha", 10),
      work("beta-two", 30, "Beta", 30),
    ];

    const groups = groupVoiceActorWorks(works);

    expect(groups.map((group) => group.key)).toEqual([
      "actor:30",
      "actor:20",
      "actor:10",
      "actor:unknown",
    ]);
    expect(groups.map((group) => group.worksCount)).toEqual([2, 2, 1, 1]);
  });

  it("sorts equal-count accented names with a fixed locale", () => {
    const groups = groupVoiceActorWorks([
      work("zoe", 3, "Zoë", 3),
      work("emile", 2, "Émile", 2),
      work("ake", 1, "Åke", 1),
    ]);

    expect(groups.map((group) => group.actor.name)).toEqual(["Åke", "Émile", "Zoë"]);
  });

  it("preserves input ordering inside each group", () => {
    const works = [
      work("later", 42, "Harrison Ford", 42),
      work("other", 9, "Other Actor", 9),
      work("earlier", 42, "Harrison Ford", 42),
    ];

    const groups = groupVoiceActorWorks(works);
    const harrison = groups.find((group) => group.actorId === 42);

    expect(harrison?.works.map((item) => item.label)).toEqual(["later", "earlier"]);
  });

  it("groups before pagination and counts groups in grouped mode", () => {
    const works = [
      ...Array.from({ length: 13 }, (_, index) =>
        work(`harrison-${index + 1}`, 42, "Harrison Ford", 42),
      ),
      ...Array.from({ length: 12 }, (_, index) =>
        work(`actor-${index + 1}`, index + 1, `Actor ${index + 1}`, index + 1),
      ),
    ];

    const result = paginateVoiceActorWorks(works, "grouped", 1, 12);

    expect(result.data).toHaveLength(12);
    expect(result.data[0]).toMatchObject({
      key: "actor:42",
      worksCount: 13,
    });
    expect(result.pagination).toMatchObject({
      page: 1,
      pageSize: 12,
      totalItems: 13,
      totalPages: 2,
    });

    const secondPage = paginateVoiceActorWorks(works, "grouped", 2, 12);
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.data[0]).toMatchObject({ worksCount: 1 });
    expect(secondPage.data[0]).not.toMatchObject({ key: "actor:42" });
  });

  it("keeps individual work pagination in list mode", () => {
    const works = Array.from({ length: 13 }, (_, index) =>
      work(`harrison-${index + 1}`, 42, "Harrison Ford", 42),
    );

    const result = paginateVoiceActorWorks(works, "list", 1, 12);

    expect(result.data).toHaveLength(12);
    expect(result.data[0]).toBe(works[0]);
    expect(result.pagination.totalItems).toBe(13);
    expect(result.pagination.totalPages).toBe(2);
  });
});
