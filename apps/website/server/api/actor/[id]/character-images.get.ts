import { useTmdbClient } from "../../../utils";
import { MediaService } from "../../../utils/services/media";
import { getWikimediaCharacterImage } from "../../../utils/services/wikimedia-character-image";
import {
  getCreditedCharacter,
  isCharacterImageSource,
  resolveCharacterImage,
  selectTvdbCharacterImage,
  type ActorCharacterImage,
  type CharacterImageSource,
} from "../../../utils/actor-character-images";
import { setPublicCacheHeaders } from "../../../utils/cache/http";
import { withMediaServiceTimeout } from "../../../utils/media-request";
import { APP_LOCALES, readPath, readProperty } from "@app/shared-logic";

// One actor-page worth of cards; never the whole filmography.
const MAX_ITEMS = 12;
const CONCURRENCY = 4;

function parseItems(value: unknown): Array<{ mediaType: "movie" | "tv"; mediaId: number }> {
  const raw = (Array.isArray(value) ? value.join(",") : String(value ?? "")).split(",");
  const seen = new Set<string>();
  const items: Array<{ mediaType: "movie" | "tv"; mediaId: number }> = [];
  for (const entry of raw) {
    const [mediaType, id] = entry.split(":");
    const mediaId = Number(id);
    if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isSafeInteger(mediaId)) continue;
    if (mediaId < 1 || seen.has(entry)) continue;
    seen.add(entry);
    items.push({ mediaType, mediaId });
  }
  return items.slice(0, MAX_ITEMS);
}

export default defineEventHandler(async (event) => {
  const actorId = Number(getRouterParam(event, "id"));
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }

  const query = getQuery(event);
  const items = parseItems(query.items);
  const skip = new Set<CharacterImageSource>(
    String(query.skip ?? "")
      .split(",")
      .filter(isCharacterImageSource),
  );
  const requestedLanguage = typeof query.lang === "string" ? query.lang.trim() : "";
  const language = APP_LOCALES.some((locale) => locale.language === requestedLanguage)
    ? requestedLanguage
    : "en-US";

  // Lazily requested after render; provider results are already cached upstream.
  setPublicCacheHeaders(event, "detail-json");
  if (items.length === 0) return { images: {} };

  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, language);
  const images: Record<string, ActorCharacterImage | null> = {};

  let actor: unknown = null;
  try {
    actor = await withMediaServiceTimeout(
      () => tmdbClient.getPersonWithCredits(actorId, language),
      "TMDB actor",
    );
  } catch (error) {
    console.error("Character images: actor credits unavailable:", error);
  }

  async function resolveItem({ mediaType, mediaId }: (typeof items)[number]) {
    const key = `${mediaType}:${mediaId}`;
    images[key] = null;
    // The role comes from the actor's own TMDB credit in this production,
    // never from the client.
    const credits = readProperty(actor, mediaType === "movie" ? "movie_credits" : "tv_credits");
    const character = getCreditedCharacter(credits, mediaId);
    if (!character) return;

    let mediaPromise: Promise<unknown> | undefined;
    const loadMedia = () => {
      mediaPromise ??= withMediaServiceTimeout(
        async () =>
          (
            await mediaService.getMediaWithVoiceActors(mediaType, mediaId, {
              includeCollection: false,
              includeCreditsCrew: false,
              projection: "media-page",
            })
          ).media,
        `TMDB ${mediaType}`,
      );
      return mediaPromise;
    };

    images[key] = await resolveCharacterImage(
      [
        {
          source: "tvdb",
          resolve: async () => {
            const { characters } = await mediaService.getCharacterProfilePictures(
              mediaType,
              mediaId,
              await loadMedia(),
            );
            const src = selectTvdbCharacterImage(character, characters);
            return src ? { src } : null;
          },
        },
        {
          source: "wikimedia",
          resolve: async () => {
            const wikidataId = readPath(await loadMedia(), "external_ids", "wikidata_id");
            if (typeof wikidataId !== "string") return null;
            return getWikimediaCharacterImage({
              contentType: mediaType,
              contentId: mediaId,
              wikidataId,
              characterName: character,
              language,
            });
          },
        },
        // No curated DubbingBase character image exists for TMDB productions yet
        // (work rows only store the character name), so there is nothing to look up.
      ],
      skip,
    );
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        if (item) await resolveItem(item);
      }
    }),
  );

  return { images };
});
