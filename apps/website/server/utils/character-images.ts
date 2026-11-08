import { createCharacterMatcher } from "@app/shared-logic";

export const CHARACTER_IMAGE_SOURCES = ["tvdb", "wikimedia", "dubbingbase"] as const;
export type CharacterImageSource = (typeof CHARACTER_IMAGE_SOURCES)[number];

export type CharacterImage = {
  src: string;
  source: CharacterImageSource;
  attribution?: string;
  sourceUrl?: string;
};

export type CharacterImageResolver = {
  source: CharacterImageSource;
  resolve: () => Promise<Omit<CharacterImage, "source"> | null>;
};

export function isCharacterImageSource(value: string): value is CharacterImageSource {
  return CHARACTER_IMAGE_SOURCES.some((source) => source === value);
}

/**
 * The single TVDB role of this production matching one of the candidate names
 * (tried in order, existing role-name matcher). Several different matching
 * roles are ambiguous and yield nothing. The image is optional: a role without
 * one still identifies the character page.
 */
export function selectTvdbCharacter(
  names: readonly string[],
  characters: ReadonlyArray<{ id: number | string; name?: string | null; image?: string | null }>,
): { id: string; image: string | null } | null {
  for (const name of names) {
    if (!name.trim()) continue;
    const matches = createCharacterMatcher(name);
    const candidates = characters.filter((character) => character.name && matches(character.name));
    const [match] = candidates;
    if (!match) continue;
    if (new Set(candidates.map((candidate) => String(candidate.id))).size !== 1) return null;
    const image = candidates.find((candidate) => candidate.image)?.image ?? null;
    return { id: String(match.id), image: image && /^https?:\/\//.test(image) ? image : null };
  }
  return null;
}

/**
 * Tries sources strictly in order, only starting the next lookup once the
 * previous one found nothing, failed, or was skipped (e.g. the image 404'd).
 */
export async function resolveCharacterImage(
  resolvers: readonly CharacterImageResolver[],
  skip: ReadonlySet<CharacterImageSource>,
  onError?: (source: CharacterImageSource, error: unknown) => void,
): Promise<CharacterImage | null> {
  for (const resolver of resolvers) {
    if (skip.has(resolver.source)) continue;
    try {
      const image = await resolver.resolve();
      if (image) return { ...image, source: resolver.source };
    } catch (error) {
      console.error(`Character image source ${resolver.source} failed:`, error);
      onError?.(resolver.source, error);
    }
  }
  return null;
}
