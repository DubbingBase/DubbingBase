import { describe, expect, it, vi } from "vitest";
import type { VoiceActorCreationPayload } from "../composables/useMetadataCreation";
import {
  changedVoiceActorProfileFields,
  createVoiceActorProfileSaveClient,
  assertVoiceActorCreationCanSave,
  displayedSocialLinks,
  isVoiceActorProfileConflict,
  mergeDisplayedSocialLinks,
  profileUnchangedExceptPicture,
  refreshVoiceActorProfilePicture,
  refreshVoiceActorCreationProfilePicture,
  VoiceActorProfileRefreshError,
  type VoiceActorProfile,
} from "./voice-actor-profile-save";

const payload: VoiceActorCreationPayload = {
  firstname: "First",
  lastname: "Last",
  bio: "Before",
  nationality: null,
  date_of_birth: null,
  awards: null,
  years_active: null,
  social_media_links: {
    website: "https://example.test",
    other: "https://other.test",
  },
  profile_picture: "picture.png",
  tmdb_id: 7,
  wikidata_id: null,
};

function profile(overrides: Partial<VoiceActorProfile> = {}): VoiceActorProfile {
  return {
    id: 41,
    firstname: "First",
    lastname: "Last",
    bio: "Before",
    nationality: null,
    date_of_birth: null,
    awards: null,
    years_active: null,
    social_media_links: null,
    profile_picture: null,
    tmdb_id: null,
    wikidata_id: null,
    status: null,
    created_at: null,
    created_by: null,
    updated_at: "2026-10-27T12:00:00Z",
    updated_by: null,
    duplicate_first_name_tokens: null,
    duplicate_last_name_tokens: null,
    ...overrides,
  };
}

describe("voice actor profile saves", () => {
  it("sends only changed fields, including no unchanged protected fields", () => {
    expect(changedVoiceActorProfileFields(payload, { ...payload, bio: "After" })).toEqual({
      bio: "After",
    });
    expect(
      changedVoiceActorProfileFields(payload, {
        ...payload,
        social_media_links: {
          other: "https://other.test",
          website: "https://example.test",
        },
      }),
    ).toEqual({});
  });

  it("preserves unseen social links and only removes a visible link when edited", () => {
    const original = {
      website: "https://example.test",
      other: "https://other.test",
      twitter: null,
    };
    const displayed = displayedSocialLinks(original);
    expect(mergeDisplayedSocialLinks(original, displayed)).toEqual(original);
    expect(mergeDisplayedSocialLinks(original, { ...displayed, website: "" })).toEqual({
      other: "https://other.test",
      twitter: null,
    });
    expect(mergeDisplayedSocialLinks(null, displayedSocialLinks(null))).toBeNull();
  });

  it("reuses an identical failed request and starts a new ID after success", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({
        profile: profile({ bio: "After", updated_at: "2026-10-27T12:01:00Z" }),
      });
    const randomUUID = vi.fn().mockReturnValueOnce("first-id").mockReturnValueOnce("second-id");
    const save = createVoiceActorProfileSaveClient(transport, randomUUID);
    const request = {
      voice_actor_id: 41,
      expected_updated_at: "2026-10-27T12:00:00Z",
      updates: { bio: "After" },
    };
    await expect(save(request)).rejects.toThrow("network");
    await expect(save(request)).resolves.toMatchObject({ bio: "After" });
    expect(transport.mock.calls[0]?.[0].request_id).toBe("first-id");
    expect(transport.mock.calls[1]?.[0].request_id).toBe("first-id");
    await save({
      ...request,
      expected_updated_at: "2026-10-27T12:01:00Z",
      updates: { bio: "Again" },
    });
    expect(transport.mock.calls[2]?.[0].request_id).toBe("second-id");
  });

  it("keeps the retry ID after an invalid response and recognizes conflicts", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ profile: profile({ updated_at: null }) })
      .mockResolvedValueOnce({ profile: profile() });
    const save = createVoiceActorProfileSaveClient(transport, () => "same-id");
    const request = {
      voice_actor_id: 41,
      expected_updated_at: "2026-10-27T12:00:00Z",
      updates: { bio: "After" },
    };
    await expect(save(request)).rejects.toThrow("invalid version");
    await save(request);
    expect(transport.mock.calls[0]?.[0].request_id).toBe(transport.mock.calls[1]?.[0].request_id);
    expect(isVoiceActorProfileConflict({ data: { statusCode: 409 } })).toBe(true);
    expect(isVoiceActorProfileConflict({ statusCode: 500 })).toBe(false);
  });

  it("accepts a picture refresh only when no other field changed concurrently", () => {
    const before = profile();
    expect(
      profileUnchangedExceptPicture(
        before,
        profile({ profile_picture: "new.png", updated_at: "later" }),
      ),
    ).toBe(true);
    expect(
      profileUnchangedExceptPicture(
        before,
        profile({ bio: "Other edit", profile_picture: "new.png" }),
      ),
    ).toBe(false);
  });

  it("retries a failed picture refresh without turning it into a profile conflict", async () => {
    const saved = profile();
    const refreshed = profile({
      profile_picture: "new.png",
      updated_at: "later",
    });
    const getProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce(refreshed);

    await expect(
      refreshVoiceActorProfilePicture(saved, "new.png", getProfile),
    ).rejects.toBeInstanceOf(VoiceActorProfileRefreshError);
    await expect(refreshVoiceActorProfilePicture(saved, "new.png", getProfile)).resolves.toEqual(
      refreshed,
    );
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it("blocks stale saves after a new profile picture refresh detects a conflict", async () => {
    const createdProfile = profile();
    const pending = {
      payload,
      requestId: "create-id",
      createdProfile,
      conflicted: false,
    };
    const saveProfile = vi.fn();
    const createVoiceActor = vi.fn();
    const saveOrCreate = vi.fn(() => {
      assertVoiceActorCreationCanSave(pending);
      return pending.createdProfile ? saveProfile() : createVoiceActor();
    });

    await expect(
      refreshVoiceActorCreationProfilePicture(pending, createdProfile, "new.png", async () =>
        profile({ bio: "Concurrent edit", profile_picture: "new.png" }),
      ),
    ).rejects.toThrow();

    expect(pending.createdProfile?.id).toBe(createdProfile.id);
    expect(pending.conflicted).toBe(true);
    expect(saveOrCreate).toThrow();
    expect(saveOrCreate).toHaveBeenCalledOnce();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(createVoiceActor).not.toHaveBeenCalled();
  });

  it("keeps a successful new-profile refresh saveable with the uploaded picture path", async () => {
    const createdProfile = profile();
    const pending = {
      payload,
      requestId: "create-id",
      createdProfile,
      conflicted: false,
    };

    await expect(
      refreshVoiceActorCreationProfilePicture(pending, createdProfile, "new.png", async () =>
        profile({ profile_picture: "new.png", updated_at: "later" }),
      ),
    ).resolves.toMatchObject({
      id: createdProfile.id,
      profile_picture: "new.png",
    });

    expect(pending.createdProfile?.id).toBe(createdProfile.id);
    expect(pending.payload.profile_picture).toBe("new.png");
    expect(pending.conflicted).toBe(false);
    expect(() => assertVoiceActorCreationCanSave(pending)).not.toThrow();
  });
});
