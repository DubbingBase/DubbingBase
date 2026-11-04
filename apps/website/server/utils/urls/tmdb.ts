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

// Reads a property of an untyped TMDB payload without assuming its shape.
const read = (obj: object, key: string): unknown => Reflect.get(obj, key);

// Non-string values map to undefined, which buildTmdbImageUrl turns into null (same as the
// previous falsy-value behavior).
const asPath = (value: unknown): string | null | undefined =>
  typeof value === "string" || value === null ? value : undefined;

const asObjectList = (value: unknown): object[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is object => typeof item === "object" && item !== null)
    : undefined;

const cleanOptionalCharacterName = (name: unknown) =>
  typeof name === "string" && name ? cleanCharacterName(name) : name;

const processPerson = (person: object) => ({
  ...person,
  character: cleanOptionalCharacterName(read(person, "character")),
  profile_path: buildTmdbImageUrl(asPath(read(person, "profile_path"))),
});

export const withTmdbImageUrls = <T extends object>(media: T) => {
  const credits = read(media, "credits");
  const guestStars = asObjectList(read(media, "guest_stars"));
  const seasons = asObjectList(read(media, "seasons"));
  const episodes = asObjectList(read(media, "episodes"));

  return {
    ...media,
    backdrop_path: buildTmdbImageUrl(asPath(read(media, "backdrop_path")), "original"),
    poster_path: buildTmdbImageUrl(asPath(read(media, "poster_path")), "original"),
    profile_path: buildTmdbImageUrl(asPath(read(media, "profile_path"))),
    still_path: buildTmdbImageUrl(asPath(read(media, "still_path")), "original"),
    credits:
      typeof credits === "object" && credits !== null
        ? {
            ...credits,
            cast: asObjectList(read(credits, "cast"))?.map(processPerson),
          }
        : {},
    guest_stars: guestStars ? guestStars.map(processPerson) : [],
    seasons: seasons
      ? seasons.map((season) => ({
          ...season,
          poster_path: buildTmdbImageUrl(asPath(read(season, "poster_path")), "original"),
        }))
      : [],
    episodes: episodes
      ? episodes.map((episode) => ({
          ...episode,
          still_path: buildTmdbImageUrl(asPath(read(episode, "still_path")), "original"),
        }))
      : [],
  };
};

export const processMedia = <T extends object>(media: T | null | undefined) =>
  media ? withTmdbImageUrls(media) : null;
