import { describe, expect, it } from "vitest";
import { evaluateRevert } from "./history-revert";

const voiceActorCurrent = {
  updated_at: "2026-11-14T10:00:00Z",
  bio: "New bio",
  firstname: "Ann",
  profile_picture: "1/new.png",
};

describe("evaluateRevert: voice actor profiles", () => {
  const subject = {
    entity_type: "voice_actors",
    entity_id: "1",
    previous_value: { bio: "Old bio", firstname: "Ann", profile_picture: "1/old.png" },
    new_value: { bio: "New bio", firstname: "Ann", profile_picture: "1/new.png" },
  };

  it("plans a revert of exactly the changed fields while they still hold the entry's values", () => {
    expect(evaluateRevert(subject, voiceActorCurrent)).toEqual({
      ok: true,
      plan: {
        kind: "voice_actor",
        id: 1,
        expectedUpdatedAt: "2026-11-14T10:00:00Z",
        updates: { bio: "Old bio", profile_picture: "1/old.png" },
      },
    });
  });

  it("refuses when a later edit changed one of the fields", () => {
    expect(evaluateRevert(subject, { ...voiceActorCurrent, bio: "Someone else's fix" })).toEqual({
      ok: false,
      reason: "changed_since",
    });
  });

  it("refuses already reverted entries, creations and missing rows", () => {
    expect(
      evaluateRevert({ ...subject, reverted_at: "2026-11-15T00:00:00Z" }, voiceActorCurrent),
    ).toEqual({
      ok: false,
      reason: "already_reverted",
    });
    expect(evaluateRevert({ ...subject, previous_value: null }, voiceActorCurrent)).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(evaluateRevert(subject, null)).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("evaluateRevert: studios", () => {
  const current = {
    updated_at: "2026-11-14 10:00:00",
    city: "Lyon",
    social_media_links: { twitter: "https://x.com/a", instagram: "https://instagram.com/b" },
  };

  it("restores changed keys and clears social platforms that were added", () => {
    const result = evaluateRevert(
      {
        entity_type: "studio",
        entity_id: "3",
        previous_value: { city: "Paris", social_media_links: { twitter: "https://x.com/a" } },
        new_value: { city: "Lyon", social_media_links: current.social_media_links },
      },
      current,
    );
    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "studio",
        id: 3,
        expectedUpdatedAt: "2026-11-14 10:00:00",
        updates: {
          city: "Paris",
          social_media_links: { twitter: "https://x.com/a", instagram: null },
        },
      },
    });
  });

  it("refuses a name revert to an empty previous name", () => {
    expect(
      evaluateRevert(
        {
          entity_type: "studio",
          entity_id: "3",
          previous_value: { name: null },
          new_value: { name: "X" },
        },
        { updated_at: "2026-11-14 10:00:00", name: "X" },
      ),
    ).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("evaluateRevert: cast credits", () => {
  const current = {
    updated_at: "2026-11-14T10:00:00Z",
    performance: "voice",
    reviewed_status: "waiting",
  };

  it("deletes a credit that an entry created", () => {
    expect(
      evaluateRevert(
        {
          entity_type: "work",
          entity_id: "9",
          previous_value: null,
          new_value: { performance: "voice" },
        },
        current,
      ),
    ).toEqual({
      ok: true,
      plan: { kind: "work_delete", id: 9, expectedUpdatedAt: "2026-11-14T10:00:00Z" },
    });
  });

  it("restores performance and always ends at the entry's starting review status", () => {
    expect(
      evaluateRevert(
        {
          entity_type: "work",
          entity_id: "9",
          previous_value: { performance: "dialogues", reviewed_status: "waiting" },
          new_value: { performance: "voice", reviewed_status: "waiting" },
        },
        current,
      ),
    ).toEqual({
      ok: true,
      plan: {
        kind: "work_update",
        id: 9,
        expectedUpdatedAt: "2026-11-14T10:00:00Z",
        performance: "dialogues",
        reviewedStatus: "waiting",
      },
    });
  });

  it("does not revert role or voice actor reassignments", () => {
    expect(
      evaluateRevert(
        {
          entity_type: "work",
          entity_id: "9",
          previous_value: { character_name: "A", reviewed_status: "waiting" },
          new_value: { character_name: "B", reviewed_status: "waiting" },
        },
        { ...current, character_name: "B" },
      ),
    ).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuses when the credit is gone or edited since", () => {
    const subject = {
      entity_type: "work",
      entity_id: "9",
      previous_value: { performance: "dialogues", reviewed_status: "waiting" },
      new_value: { performance: "voice", reviewed_status: "waiting" },
    };
    expect(evaluateRevert(subject, null)).toEqual({ ok: false, reason: "unsupported" });
    expect(evaluateRevert(subject, { ...current, performance: "chant" })).toEqual({
      ok: false,
      reason: "changed_since",
    });
  });
});
