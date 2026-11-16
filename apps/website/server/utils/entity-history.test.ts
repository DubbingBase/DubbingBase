import { describe, expect, it } from "vitest";
import { diffSnapshots, toHistoryEntry } from "./entity-history";

const base = {
  id: "audit-1",
  created_at: "2026-11-14T10:00:00Z",
  action: "update",
  user_name: "Alice",
};

describe("diffSnapshots", () => {
  it("lists only allowlisted fields whose value changed", () => {
    expect(
      diffSnapshots(
        "profile",
        { bio: "Old", created_by: "secret-user", updated_by: "secret-user", firstname: "Ann" },
        { bio: "New", created_by: "other", updated_by: "other", firstname: "Ann" },
      ),
    ).toEqual([{ field: "bio", before: "Old", after: "New" }]);
  });

  it("reads a missing snapshot as null so creations and deletions show every field", () => {
    expect(diffSnapshots("work", null, { character_name: "Hero", status: "user" })).toEqual([
      { field: "character_name", before: null, after: "Hero" },
    ]);
    expect(diffSnapshots("work", { performance: "voice" }, null)).toEqual([
      { field: "performance", before: "voice", after: null },
    ]);
  });

  it("diffs studio patches that only hold the changed keys", () => {
    expect(diffSnapshots("studio", { city: "Paris" }, { city: "Lyon" })).toEqual([
      { field: "city", before: "Paris", after: "Lyon" },
    ]);
  });
});

describe("toHistoryEntry", () => {
  it("never exposes internal columns or user ids", () => {
    const entry = toHistoryEntry(
      {
        ...base,
        entity_type: "voice_actors",
        previous_value: { bio: "Old", created_by: "user-id-1" },
        new_value: { bio: "New", created_by: "user-id-1", updated_by: "user-id-2" },
      },
      "voice_actor",
    );
    expect(entry).toEqual({
      id: "audit-1",
      createdAt: "2026-11-14T10:00:00Z",
      action: "update",
      contributor: "Alice",
      target: "profile",
      label: null,
      changes: [{ field: "bio", before: "Old", after: "New" }],
    });
    expect(JSON.stringify(entry)).not.toContain("user-id");
  });

  it("labels cast credit edits with the character name", () => {
    const entry = toHistoryEntry(
      {
        ...base,
        action: "create",
        entity_type: "work",
        previous_value: null,
        new_value: { character_name: "Batman", performance: "dialogues", voice_actor_id: 7 },
      },
      "voice_actor",
    );
    expect(entry?.target).toBe("cast_credit");
    expect(entry?.label).toBe("Batman");
  });

  it("drops entries without a visible change", () => {
    expect(
      toHistoryEntry(
        {
          ...base,
          entity_type: "voice_actor",
          previous_value: { updated_at: "a" },
          new_value: { updated_at: "b" },
        },
        "voice_actor",
      ),
    ).toBeNull();
  });
});
