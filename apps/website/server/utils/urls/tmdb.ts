export const TMDB_CONFIG = {
  baseUrl: "https://image.tmdb.org/t/p",
  defaultSize: "w500",
} as const;

export function buildTmdbImageUrl(
  imagePath: string | null | undefined,
  size: string = TMDB_CONFIG.defaultSize,
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;

  const cleanPath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return `${TMDB_CONFIG.baseUrl}/${size}/${cleanPath}`;
}

export const cleanCharacterName = (name: string): string => {
  if (!name) return name;
  return name
    .replace(/\s*\([^)]*(?:voice|uncredited|voix|non cr[ée]dit[ée]?)[^)]*\)\s*/gi, "")
    .trim();
};

type TmdbImageMember = Record<string, unknown> & {
  character?: string | null;
  profile_path?: string | null;
  poster_path?: string | null;
  still_path?: string | null;
};

type ProcessedMedia<T extends Record<string, unknown>> = T & {
  backdrop_path: string | null;
  poster_path: string | null;
  profile_path: string | null;
  still_path: string | null;
  credits: Record<string, unknown> & { cast?: TmdbImageMember[] };
  guest_stars: TmdbImageMember[];
  seasons: TmdbImageMember[];
  episodes: TmdbImageMember[];
  external_ids?: { wikidata_id?: string | null } | null;
  adult?: boolean | null;
  title?: string;
  name?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTmdbImageMember(value: unknown): value is TmdbImageMember {
  return (
    isRecord(value) &&
    (value.character === undefined ||
      value.character === null ||
      typeof value.character === "string") &&
    (value.profile_path === undefined ||
      value.profile_path === null ||
      typeof value.profile_path === "string") &&
    (value.poster_path === undefined ||
      value.poster_path === null ||
      typeof value.poster_path === "string") &&
    (value.still_path === undefined ||
      value.still_path === null ||
      typeof value.still_path === "string")
  );
}

function optionalImagePath(value: unknown): string | null | undefined {
  return typeof value === "string" || value === null ? value : undefined;
}

export function processMedia<T extends Record<string, unknown>>(media: T): ProcessedMedia<T> {
  const rawCredits = media.credits;
  const credits = isRecord(rawCredits) ? rawCredits : undefined;
  const cast = Array.isArray(credits?.cast)
    ? credits.cast.filter(isTmdbImageMember).map((castMember) => ({
        ...castMember,
        character: cleanCharacterName(castMember.character ?? ""),
        profile_path: buildTmdbImageUrl(castMember.profile_path),
      }))
    : undefined;
  const guestStars = Array.isArray(media.guest_stars)
    ? media.guest_stars.filter(isTmdbImageMember).map((guest) => ({
        ...guest,
        character: cleanCharacterName(guest.character ?? ""),
        profile_path: buildTmdbImageUrl(guest.profile_path),
      }))
    : [];
  const seasons = Array.isArray(media.seasons)
    ? media.seasons.filter(isTmdbImageMember).map((season) => ({
        ...season,
        poster_path: buildTmdbImageUrl(season.poster_path, "original"),
      }))
    : [];
  const episodes = Array.isArray(media.episodes)
    ? media.episodes.filter(isTmdbImageMember).map((episode) => ({
        ...episode,
        still_path: buildTmdbImageUrl(episode.still_path, "original"),
      }))
    : [];

  return {
    ...media,
    backdrop_path: buildTmdbImageUrl(optionalImagePath(media.backdrop_path), "original"),
    poster_path: buildTmdbImageUrl(optionalImagePath(media.poster_path), "original"),
    profile_path: buildTmdbImageUrl(optionalImagePath(media.profile_path)),
    still_path: buildTmdbImageUrl(optionalImagePath(media.still_path), "original"),
    credits: credits ? { ...credits, cast } : {},
    guest_stars: guestStars,
    seasons,
    episodes,
  };
}
