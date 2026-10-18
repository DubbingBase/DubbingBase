function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickFields(value: Record<string, unknown>, fields: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in value) result[field] = value[field];
  }
  return result;
}

interface ActorDetailResponse {
  actor: Record<string, unknown> & {
    credits: { cast: Record<string, unknown>[] };
    voice_roles: Record<string, unknown>[];
  };
  voiceActors: Record<string, unknown>[];
}

// Keep all entries used for search, language selection and pagination. Raw
// provider credits and editorial metadata remain in the default API response.
export function actorPageResponse(response: ActorDetailResponse) {
  const voiceRoles = response.actor.voice_roles.map((role) => ({
    ...pickFields(role, ["id", "performance", "mediaDetails"]),
    dubbing_projects: isRecord(role.dubbing_projects)
      ? pickFields(role.dubbing_projects, ["language"])
      : null,
    voice_actors: Array.isArray(role.voice_actors)
      ? role.voice_actors
          .filter(isRecord)
          .map((actor) =>
            pickFields(actor, [
              "id",
              "firstname",
              "lastname",
              "profile_picture",
              "voice_actor_name",
            ]),
          )
      : [],
  }));

  return {
    actor: {
      ...pickFields(response.actor, [
        "id",
        "name",
        "biography",
        "birthday",
        "deathday",
        "place_of_birth",
        "profile_path",
        "known_for_department",
      ]),
      credits: {
        cast: response.actor.credits.cast.map((credit) =>
          pickFields(credit, [
            "id",
            "title",
            "name",
            "original_title",
            "original_name",
            "character",
            "poster_path",
            "release_date",
            "first_air_date",
            "media_type",
          ]),
        ),
      },
      voice_roles: voiceRoles,
    },
    voiceActors: voiceRoles,
  };
}
