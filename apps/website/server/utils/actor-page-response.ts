export type ActorPageVoiceRole = {
  id: number;
  performance: string | null;
  dubbing_projects: { language: string; content_id: number } | null;
  voice_actors: Array<{
    id: number;
    firstname: string;
    lastname: string;
    profile_picture: string | null;
  }>;
};

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
  voiceRoles: ActorPageVoiceRole[],
  profilePath: string | null,
  options?: { filmographyCount: number },
) {
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
      voice_roles: voiceRoles,
    },
  };
}
