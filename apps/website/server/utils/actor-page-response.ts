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

// Keep only fields used by actor-page rendering. Raw provider credits and
// editorial metadata remain in the default API response.
export function actorPageResponse(
  actor: Record<string, unknown>,
  actorCredits: Record<string, unknown>[],
  voiceRoles: Record<string, unknown>[],
  profilePath: string | null,
  options?: { filmographyCount: number },
) {
  const projectedVoiceRoles = voiceRoles.map((role) => ({
    ...pickFields(role, ["id", "performance"]),
    dubbing_projects: isRecord(role.dubbing_projects)
      ? pickFields(role.dubbing_projects, ["language", "content_id"])
      : null,
    voice_actors: Array.isArray(role.voice_actors)
      ? role.voice_actors
          .filter(isRecord)
          .map((actor) => pickFields(actor, ["id", "firstname", "lastname", "profile_picture"]))
      : [],
  }));

  const projectedActor = pickFields(actor, [
    "id",
    "name",
    "biography",
    "birthday",
    "deathday",
    "place_of_birth",
    "known_for_department",
  ]);
  projectedActor.profile_path = profilePath;

  return {
    ...(options ? { filmographyCount: options.filmographyCount } : {}),
    actor: {
      ...projectedActor,
      credits: { cast: actorCredits },
      voice_roles: projectedVoiceRoles,
    },
  };
}
