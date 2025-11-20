/**
 * TMDB URL utility module for basic TMDB image URL generation
 */

// TMDB Configuration
export const TMDB_CONFIG = {
  baseUrl: 'https://image.tmdb.org/t/p',
  defaultSize: 'w500'
} as const;

/**
 * Constructs a TMDB image URL with specified size
 */
export function buildTmdbImageUrl(
  imagePath: string | null | undefined,
  size: string = TMDB_CONFIG.defaultSize
): string | null {
  if (!imagePath) return null;

  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  // Build base TMDB URL
  return `${TMDB_CONFIG.baseUrl}/${size}/${cleanPath}`;
}

export const processMedia = (media: any) => {
  if (!media) return null;

  return {
    ...media,
    backdrop_path: buildTmdbImageUrl(media.backdrop_path),
    poster_path: buildTmdbImageUrl(media.poster_path),
    profile_path: buildTmdbImageUrl(media.profile_path),
    credits: media.credits ? {
      ...media.credits,
      cast: media.credits.cast.map((castMember: any) => ({
        ...castMember,
        profile_path: buildTmdbImageUrl(castMember.profile_path)
      }))
    } : {},
    seasons: media.seasons ? (media.seasons ?? []).map((season: any) => ({
      ...season,
      poster_path: buildTmdbImageUrl(season.poster_path)
    })) : {}
  };
}
