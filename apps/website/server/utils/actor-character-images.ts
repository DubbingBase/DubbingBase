import { isRecord, readProperty } from "@app/shared-logic";
import { cleanCharacterName } from "./urls/tmdb";

export const CHARACTER_IMAGE_SOURCES = ["tvdb", "wikimedia", "dubbingbase"] as const;
export type CharacterImageSource = (typeof CHARACTER_IMAGE_SOURCES)[number];

export type ActorCharacterImage = {
  src: string;
  source: CharacterImageSource;
  attribution?: string;
  sourceUrl?: string;
};

export type CharacterImageResolver = {
  source: CharacterImageSource;
  resolve: () => Promise<Omit<ActorCharacterImage, "source"> | null>;
};

export function isCharacterImageSource(value: string): value is CharacterImageSource {
  return CHARACTER_IMAGE_SOURCES.some((source) => source === value);
}

function normalizedRole(value: string): string {
  return cleanCharacterName(value).normalize("NFKC").trim().toLocaleLowerCase();
}

/**
 * The role the actor is credited with in one production, or null when the
 * actor has no credit or several different roles there (ambiguous).
 */
export function getCreditedCharacter(credits: unknown, mediaId: number): string | null {
  const cast = readProperty(credits, "cast");
  if (!Array.isArray(cast)) return null;
  const roles = new Map<string, string>();
  for (const credit of cast) {
    if (!isRecord(credit) || credit.id !== mediaId || typeof credit.character !== "string") {
      continue;
    }
    const key = normalizedRole(credit.character);
    if (key) roles.set(key, cleanCharacterName(credit.character));
  }
  const [role] = roles.values();
  return roles.size === 1 && role ? role : null;
}

/** Image of the single TVDB role of this production named like the credited role. */
export function selectTvdbCharacterImage(
  characterName: string,
  characters: ReadonlyArray<{ name: string; image: string }>,
): string | null {
  const wanted = normalizedRole(characterName);
  if (!wanted) return null;
  const matches = characters.filter((character) => normalizedRole(character.name) === wanted);
  const [match] = matches;
  if (matches.length !== 1 || !match) return null;
  return /^https?:\/\//.test(match.image) ? match.image : null;
}

/**
 * Tries sources strictly in order, only starting the next lookup once the
 * previous one found nothing, failed, or was skipped (e.g. the image 404'd).
 */
export async function resolveCharacterImage(
  resolvers: readonly CharacterImageResolver[],
  skip: ReadonlySet<CharacterImageSource>,
): Promise<ActorCharacterImage | null> {
  for (const resolver of resolvers) {
    if (skip.has(resolver.source)) continue;
    try {
      const image = await resolver.resolve();
      if (image) return { ...image, source: resolver.source };
    } catch (error) {
      console.error(`Character image source ${resolver.source} failed:`, error);
    }
  }
  return null;
}
