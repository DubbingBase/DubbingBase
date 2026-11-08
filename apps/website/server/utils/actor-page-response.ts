import { isRecord } from "@app/shared-logic";

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

// Backdrop of the actor's most popular (trending) credit across movies and TV.
export function pickTrendingBackdropPath(creditGroups: readonly unknown[]): string | null {
  let best: { popularity: number; path: string } | null = null;
  for (const group of creditGroups) {
    if (!isRecord(group) || !Array.isArray(group.cast)) continue;
    for (const credit of group.cast) {
      if (!isRecord(credit)) continue;
      const path = credit.backdrop_path;
      if (typeof path !== "string" || !path) continue;
      const popularity = typeof credit.popularity === "number" ? credit.popularity : 0;
      if (!best || popularity > best.popularity) best = { popularity, path };
    }
  }
  return best ? best.path : null;
}

// Keep only fields used by actor-page rendering. Raw provider credits and
// editorial metadata remain in the default API response.
export function actorPageResponse(
  actor: Record<string, unknown>,
  actorCredits: Record<string, unknown>[],
  voiceRoles: ActorPageVoiceRole[],
  profilePath: string | null,
  backdropPath: string | null,
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
  projectedActor.backdrop_path = backdropPath;

  return {
    ...(options ? { filmographyCount: options.filmographyCount } : {}),
    actor: {
      ...projectedActor,
      credits: { cast: actorCredits },
      voice_roles: voiceRoles,
    },
  };
}
