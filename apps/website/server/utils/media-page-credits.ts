function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickMediaPageCastFields(value: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if ("id" in value) result.id = value.id;
  if ("name" in value) result.name = value.name;
  if ("profile_path" in value) result.profile_path = value.profile_path;
  if ("character" in value) result.character = value.character;
  return result;
}

function pickMediaPageRoleFields(value: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if ("character" in value) result.character = value.character;
  if ("episode_count" in value) result.episode_count = value.episode_count;
  return result;
}

export function mediaPageMovieCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast.filter(isRecord).map(pickMediaPageCastFields),
  };
}

// The page renders every cast member and role, but never provider crew or
// credit bookkeeping. Keep that data in the default API response only.
export function mediaPageAggregateCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast.filter(isRecord).map((member) => ({
      ...pickMediaPageCastFields(member),
      ...(Array.isArray(member.roles)
        ? {
            roles: member.roles.filter(isRecord).map(pickMediaPageRoleFields),
          }
        : {}),
    })),
  };
}
