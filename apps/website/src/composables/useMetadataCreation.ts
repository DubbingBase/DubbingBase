import type { Tables, TablesInsert } from "@app/supabase/types";

export type VoiceActorCreationPayload = Pick<
  TablesInsert<"voice_actors">,
  | "firstname"
  | "lastname"
  | "bio"
  | "nationality"
  | "date_of_birth"
  | "awards"
  | "years_active"
  | "social_media_links"
  | "profile_picture"
  | "tmdb_id"
  | "wikidata_id"
  | "status"
>;

export function isMetadataValidationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (
    ("statusCode" in error && error.statusCode === 400) ||
    ("status" in error && error.status === 400)
  );
}

export function useMetadataCreation() {
  async function createVoiceActor(
    payload: VoiceActorCreationPayload,
    requestId: string,
  ): Promise<{ data: Tables<"voice_actors"> }> {
    return await $fetch<{ data: Tables<"voice_actors"> }>(
      "/api/save-metadata",
      {
        method: "POST",
        body: { type: "voice_actor", payload, request_id: requestId },
      },
    );
  }

  return { createVoiceActor };
}
