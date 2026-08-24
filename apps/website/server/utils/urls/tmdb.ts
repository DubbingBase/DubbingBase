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
    .replace(
      /\s*\([^)]*(?:voice|uncredited|voix|non cr[ée]dit[ée]?)[^)]*\)\s*/gi,
      "",
    )
    .trim();
};

export const processMedia = (media: any) => {
  if (!media) return null;

  return {
    ...media,
    backdrop_path: buildTmdbImageUrl(media.backdrop_path, "original"),
    poster_path: buildTmdbImageUrl(media.poster_path, "original"),
    profile_path: buildTmdbImageUrl(media.profile_path),
    still_path: buildTmdbImageUrl(media.still_path, "original"),
    credits: media.credits
      ? {
          ...media.credits,
          cast: media.credits.cast?.map((castMember: any) => ({
            ...castMember,
            character: cleanCharacterName(castMember.character),
            profile_path: buildTmdbImageUrl(castMember.profile_path),
          })),
        }
      : {},
    guest_stars: media.guest_stars
      ? media.guest_stars.map((guest: any) => ({
          ...guest,
          character: cleanCharacterName(guest.character),
          profile_path: buildTmdbImageUrl(guest.profile_path),
        }))
      : [],
    seasons: media.seasons
      ? (media.seasons ?? []).map((season: any) => ({
          ...season,
          poster_path: buildTmdbImageUrl(season.poster_path, "original"),
        }))
      : [],
    episodes: media.episodes
      ? (media.episodes ?? []).map((episode: any) => ({
          ...episode,
          still_path: buildTmdbImageUrl(episode.still_path, "original"),
        }))
      : [],
  };
};
