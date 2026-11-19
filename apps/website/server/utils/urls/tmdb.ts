export const cleanCharacterName = (name: string): string => {
  if (!name) return name;
  return name
    .replace(/\s*\([^)]*(?:voice|uncredited|voix|non cr[ée]dit[ée]?)[^)]*\)\s*/gi, "")
    .trim();
};

// Reads a property of an untyped TMDB payload without assuming its shape.
const read = (obj: object, key: string): unknown => Reflect.get(obj, key);

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
  profile_path: asPath(read(person, "profile_path")),
});

const normalizeMedia = <T extends object>(media: T) => {
  const credits = read(media, "credits");
  const guestStars = asObjectList(read(media, "guest_stars"));
  const seasons = asObjectList(read(media, "seasons"));
  const episodes = asObjectList(read(media, "episodes"));

  return {
    ...media,
    backdrop_path: asPath(read(media, "backdrop_path")),
    poster_path: asPath(read(media, "poster_path")),
    profile_path: asPath(read(media, "profile_path")),
    still_path: asPath(read(media, "still_path")),
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
          poster_path: asPath(read(season, "poster_path")),
        }))
      : [],
    episodes: episodes
      ? episodes.map((episode) => ({
          ...episode,
          still_path: asPath(read(episode, "still_path")),
        }))
      : [],
  };
};

export const processMedia = <T extends object>(media: T | null | undefined) =>
  media ? normalizeMedia(media) : null;
