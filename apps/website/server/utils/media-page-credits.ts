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

export function mediaPageMovieCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast
      .filter(isRecord)
      .map((member) => pickFields(member, ["id", "name", "profile_path", "character"])),
  };
}

// The page renders every cast member and role, but never provider crew or
// credit bookkeeping. Keep that data in the default API response only.
export function mediaPageAggregateCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast.filter(isRecord).map((member) => ({
      ...pickFields(member, ["id", "name", "original_name", "profile_path", "character"]),
      ...(Array.isArray(member.roles)
        ? {
            roles: member.roles
              .filter(isRecord)
              .map((role) => pickFields(role, ["character", "episode_count"])),
          }
        : {}),
    })),
  };
}
