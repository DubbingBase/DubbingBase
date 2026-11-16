import { describe, expect, it } from "vitest";
import { diffSnapshots, mediaPath, safeHttpUrl, toHistoryEntry } from "./entity-history";

const base = {
  id: "audit-1",
  created_at: "2026-11-14T10:00:00Z",
  action: "update",
  user_name: "Alice",
};
const context = {
  imageUrl: (path: string, field: string) =>
    `https://img.test/${field === "logo_url" ? "logos" : "pictures"}/${path}`,
  mediaHref: (projectId: number) => (projectId === 7 ? "/movie/99" : null),
};

describe("diffSnapshots", () => {
  it("lists only allowlisted fields whose value changed and flags importance", () => {
    const changes = diffSnapshots(
      "profile",
      { bio: "Old", created_by: "secret-user", firstname: "Ann", lastname: "X" },
      { bio: "New", created_by: "other", firstname: "Anna", lastname: "X" },
    );
    expect(changes.map((change) => [change.field, change.importance])).toEqual([
      ["firstname", "high"],
      ["bio", "normal"],
    ]);
    expect(JSON.stringify(changes)).not.toContain("secret-user");
  });

  it("reads a missing snapshot as null so creations and deletions show every field", () => {
    expect(
      diffSnapshots("work", null, { character_name: "Hero", status: "user" }).map((c) => c.field),
    ).toEqual(["character_name"]);
    expect(diffSnapshots("work", { performance: "voice" }, null)[0]).toMatchObject({
      field: "performance",
      before: "voice",
      after: null,
    });
  });

  it("builds deep links for external ids, websites, social links and images", () => {
    const changes = diffSnapshots(
      "profile",
      {
        tmdb_id: null,
        wikidata_id: null,
        profile_picture: "1/old.png",
        social_media_links: { twitter: "https://x.com/a" },
      },
      {
        tmdb_id: 42,
        wikidata_id: "Q42",
        profile_picture: "1/new.png",
        social_media_links: { twitter: "https://x.com/a", instagram: "https://instagram.com/b" },
      },
      context,
    );
    const byField = Object.fromEntries(changes.map((change) => [change.field, change]));
    expect(byField.tmdb_id?.afterHref).toBe("https://www.themoviedb.org/person/42");
    expect(byField.wikidata_id?.afterHref).toBe("https://www.wikidata.org/wiki/Q42");
    expect(byField.profile_picture).toMatchObject({
      type: "image",
      beforeHref: "https://img.test/pictures/1/old.png",
      afterHref: "https://img.test/pictures/1/new.png",
    });
    // Social links are expanded per platform and only the changed platform appears.
    expect(Object.keys(byField).filter((field) => field.startsWith("social_media_links"))).toEqual([
      "social_media_links.instagram",
    ]);
    expect(byField["social_media_links.instagram"]?.afterHref).toBe("https://instagram.com/b");
  });

  it("never turns non-http values into links", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https://user:pw@example.com")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("https://example.com/x")).toBe("https://example.com/x");
    const [change] = diffSnapshots(
      "studio",
      { website_url: null },
      { website_url: "javascript:alert(1)" },
    );
    expect(change?.afterHref).toBeNull();
    expect(
      diffSnapshots("profile", { tmdb_id: null }, { tmdb_id: "../../etc" })[0]?.afterHref,
    ).toBeNull();
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
    expect(entry).toMatchObject({
      contributor: "Alice",
      kind: "edited",
      important: false,
      target: "profile",
      reverted: false,
      revertable: false,
    });
    expect(JSON.stringify(entry)).not.toContain("user-id");
  });

  it("labels cast credit edits, links to the media and classifies the kind", () => {
    const created = toHistoryEntry(
      {
        ...base,
        action: "create",
        entity_type: "work",
        previous_value: null,
        new_value: { character_name: "Batman", voice_actor_id: 7, dubbing_project_id: 7 },
      },
      "voice_actor",
      context,
    );
    expect(created).toMatchObject({
      kind: "created",
      target: "cast_credit",
      label: "Batman",
      href: "/movie/99",
      important: true,
    });

    const verified = toHistoryEntry(
      {
        ...base,
        action: "update_review_status",
        entity_type: "work",
        previous_value: { reviewed_status: "waiting", character_name: "Batman" },
        new_value: { reviewed_status: "accepted", character_name: "Batman" },
      },
      "voice_actor",
    );
    expect(verified?.kind).toBe("verification");
    expect(verified?.changes[0]).toMatchObject({ type: "status", importance: "high" });

    const deleted = toHistoryEntry(
      {
        ...base,
        action: "delete",
        entity_type: "work",
        previous_value: { character_name: "Batman" },
        new_value: null,
      },
      "voice_actor",
    );
    expect(deleted?.kind).toBe("deleted");
  });

  it("marks reverted entries and drops entries without a visible change", () => {
    expect(
      toHistoryEntry(
        {
          ...base,
          entity_type: "studio",
          previous_value: { city: "A" },
          new_value: { city: "B" },
          reverted_at: "2026-11-15T00:00:00Z",
        },
        "studio",
      )?.reverted,
    ).toBe(true);
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

describe("mediaPath", () => {
  it("maps content types to site paths and rejects unknown ones", () => {
    expect(mediaPath("tv", 5)).toBe("/show/5");
    expect(mediaPath("video_game", 5)).toBe("/game/5");
    expect(mediaPath("weird", 5)).toBeNull();
  });
});
