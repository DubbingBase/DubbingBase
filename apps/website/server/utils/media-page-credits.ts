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

const MEDIA_PAGE_CAST_FIELDS = ["id", "name", "profile_path", "character"] as const;
const MEDIA_PAGE_ROLE_FIELDS = ["character", "episode_count"] as const;

export function mediaPageMovieCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast.filter(isRecord).map((member) => pickFields(member, MEDIA_PAGE_CAST_FIELDS)),
  };
}

// The page renders every cast member and role, but never provider crew or
// credit bookkeeping. Keep that data in the default API response only.
export function mediaPageAggregateCredits(credits: unknown) {
  const cast = isRecord(credits) && Array.isArray(credits.cast) ? credits.cast : [];
  return {
    cast: cast.filter(isRecord).map((member) => ({
      ...pickFields(member, MEDIA_PAGE_CAST_FIELDS),
      ...(Array.isArray(member.roles)
        ? {
            roles: member.roles
              .filter(isRecord)
              .map((role) => pickFields(role, MEDIA_PAGE_ROLE_FIELDS)),
          }
        : {}),
    })),
  };
}
