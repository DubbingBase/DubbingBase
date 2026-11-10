import { useSupabaseAdmin } from "../../../utils/db/client";
import { useIgdbClient, useTmdbClient, useTvdbClient } from "../../../utils";
import { buildIgdbImageUrl } from "../../../utils/api/igdb";
import { isRecord, readProperty } from "@app/shared-logic";
import { MediaService } from "../../../utils/services/media";
import { getDubbingProjects, getGamePageDubbingProjects } from "../../../utils/db/queries";
import { loadGameCharacterCatalog } from "../../../utils/game-characters";
import { formatGameDetailCastCards } from "@app/shared-logic";

function normalizedName(value: string | null | undefined): string {
  return value?.normalize("NFKC").trim().toLocaleLowerCase() ?? "";
}

export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, "source");
  const id = getRouterParam(event, "id");
  const supabase = useSupabaseAdmin(event);

  if (source === "tvdb") {
    const characterId = Number(id);
    const query = getQuery(event);
    const mediaType = query.mediaType;
    const mediaId = Number(query.mediaId);
    if (!Number.isSafeInteger(characterId) || characterId < 1) {
      throw createError({ statusCode: 404, statusMessage: "Character not found" });
    }
    if (
      (mediaType !== "movie" && mediaType !== "tv") ||
      !Number.isSafeInteger(mediaId) ||
      mediaId < 1
    ) {
      throw createError({ statusCode: 404, statusMessage: "Character appearance not found" });
    }

    const tmdbClient = useTmdbClient();
    const mediaService = new MediaService(tmdbClient, getHeader(event, "accept-language"));
    const { media } = await mediaService.getMediaWithVoiceActors(mediaType, mediaId, {
      includeCollection: false,
      includeCreditsCrew: false,
      projection: "media-page",
    });
    const { characters } = await mediaService.getCharacterProfilePictures(
      mediaType,
      mediaId,
      async () => media,
    );
    const character = characters.find((candidate) => String(candidate.id) === id);
    if (!character) throw createError({ statusCode: 404, statusMessage: "Character not found" });

    let providerCharacter: Record<string, unknown> = {};
    try {
      const response = await useTvdbClient().getCharacterById(
        characterId,
        getHeader(event, "accept-language"),
      );
      const value: unknown = isRecord(response) ? response.data : undefined;
      if (isRecord(value)) providerCharacter = value;
    } catch {
      // Keep the stored dubbing credits usable when TVDB is unavailable.
    }
    const name =
      typeof providerCharacter.name === "string" ? providerCharacter.name : character.name;
    const matchingNames = new Set(
      characters.map((entry) => normalizedName(entry.name)).filter(Boolean),
    );
    const uniqueRoleName =
      matchingNames.has(normalizedName(name)) &&
      characters.filter((entry) => normalizedName(entry.name) === normalizedName(name)).length ===
        1;
    const projects = uniqueRoleName ? await getDubbingProjects(mediaId, mediaType) : [];
    const credits = projects.flatMap((project) =>
      (project.works ?? [])
        .filter((work) => normalizedName(work.character_name) === normalizedName(name))
        .map((work) => ({ project, work })),
    );
    const mediaTitle = isRecord(media)
      ? typeof media.title === "string"
        ? media.title
        : typeof media.name === "string"
          ? media.name
          : null
      : null;
    const tmdbCast =
      isRecord(media) && isRecord(media.credits) && Array.isArray(media.credits.cast)
        ? media.credits.cast
        : [];
    const originalPerformers = tmdbCast.flatMap((person) => {
      if (!isRecord(person)) return [];
      const performerId = readProperty(person, "id");
      const performerName = readProperty(person, "name");
      return typeof performerId === "number" && readProperty(person, "character") === name
        ? [{ id: performerId, name: typeof performerName === "string" ? performerName : null }]
        : [];
    });
    return {
      source: "tvdb" as const,
      id: characterId,
      name,
      image:
        typeof providerCharacter.image === "string" ? providerCharacter.image : character.image,
      description:
        typeof providerCharacter.overview === "string" ? providerCharacter.overview : null,
      externalUrl: `https://thetvdb.com/characters/${characterId}`,
      gameId: null,
      igdbCharacterId: null,
      appearances: [
        {
          project: {
            id: mediaId,
            language: null,
            content_id: mediaId,
            content_type: mediaType,
            title: mediaTitle,
            studio_data: null,
          },
          originalPerformers,
          credits: credits.map(({ project, work }) => ({
            id: work.id,
            language: project.language,
            studio: project.studio_data?.name ?? null,
            voiceActor: work.voice_actor,
            performance: work.performance,
            note: work.note,
          })),
        },
      ],
    };
  }

  if (source === "game") {
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw createError({ statusCode: 404, statusMessage: "Character not found" });
    }
    const { data: character, error } = await supabase
      .from("game_characters")
      .select("id, igdb_game_id, name, igdb_character_id")
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw createError({ statusCode: 500, statusMessage: "Character could not be loaded" });
    if (!character) throw createError({ statusCode: 404, statusMessage: "Character not found" });

    const characterCatalog = await loadGameCharacterCatalog(event, character.igdb_game_id, () =>
      useIgdbClient().getGameCharacters(character.igdb_game_id),
    );
    const gameProjects = await getGamePageDubbingProjects(character.igdb_game_id);
    const localCharacter = characterCatalog.characters.find(
      (entry) => entry.game_character_id === character.id,
    );
    const localCharacterKey = localCharacter
      ? String(localCharacter.id ?? localCharacter.stable_id ?? localCharacter.game_character_id)
      : null;
    const scopedProjects = gameProjects.map((project) => ({
      project,
      cards: localCharacter
        ? formatGameDetailCastCards([localCharacter], project).filter(
            (card) =>
              card.work_id !== undefined &&
              localCharacterKey !== null &&
              String(card.id).startsWith(`${localCharacterKey}-`),
          )
        : [],
    }));
    const imageId = localCharacter?.mug_shot?.image_id;
    const image = imageId ? buildIgdbImageUrl(imageId, "1080p") : null;
    return {
      source: "game" as const,
      id: character.id,
      name: character.name,
      image,
      description: localCharacter?.description ?? null,
      externalUrl: null,
      gameId: character.igdb_game_id,
      igdbCharacterId: character.igdb_character_id,
      appearances: scopedProjects.flatMap(({ project, cards }) =>
        cards.map((card) => ({
          project: {
            id: project.id,
            language: project.language,
            content_id: character.igdb_game_id,
            content_type: "video_game",
            title: null,
            studio_data: project.studio_data,
          },
          originalPerformers: [],
          credits: project.works
            .filter((work) => work.id === card.work_id)
            .map((work) => ({
              id: work.id,
              language: project.language,
              studio: project.studio_data?.name ?? null,
              voiceActor: work.voice_actor,
              performance: work.performance,
              note: work.note,
            })),
        })),
      ),
    };
  }

  throw createError({ statusCode: 404, statusMessage: "Character not found" });
});
