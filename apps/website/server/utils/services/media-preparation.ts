import { findOrCreateDubbingProject } from "../db/dubbing-project";
import { insertVoiceActorAndWork } from "./voice-actor";
import { useWikipediaCache, useIgdbClient } from "../index";
import { buildTmdbImageUrl } from "../urls/tmdb";
import { buildIgdbImageUrl } from "../api/igdb";

export interface PrepareMediaResult {
  ok: boolean;
  changes?: number;
  creditsAdded?: number;
  title?: string;
  imageUrl?: string;
  error?: string;
}

export interface PrepareGameResult {
  ok: boolean;
  changes?: number;
  creditsAdded?: number;
  title?: string;
  imageUrl?: string;
  note?: string;
  error?: string;
}

export async function prepareMedia(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<PrepareMediaResult> {
  const { tmdbId, type } = options;
  const lang = "fr";
  let mediaTitle = "Unknown title";

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?append_to_response=credits,external_ids&language=fr-FR`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from TMDB API: status ${response.status}`,
      );
    }

    const movie = (await response.json()) as any;
    mediaTitle = movie.title || movie.name || "Unknown title";

    await findOrCreateDubbingProject(tmdbId, tmdbType);

    const wikiId = movie.external_ids?.wikidata_id;
    if (!wikiId) {
      throw new Error(
        "Could not find wikidata_id associated with this TMDB ID",
      );
    }

    const wikipediaCache = useWikipediaCache();
    const entity = await wikipediaCache.getWikidataEntity(wikiId);
    const wikipediaPageTitle =
      entity.entities[wikiId]?.sitelinks?.[lang + "wiki"]?.title;

    if (!wikipediaPageTitle) {
      throw new Error("Pas de page Wikipédia en français pour ce média.");
    }

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
      wikipediaPageTitle,
      lang,
    );

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const wikipediaLangPageId = firstPage
      ? pages[firstPage]?.pageid
      : undefined;

    if (!wikipediaLangPageId) {
      throw new Error("Could not get page ID from Wikipedia search");
    }

    const wikipediaPageSections =
      await wikipediaCache.getPageSections(wikipediaLangPageId);

    const sections =
      wikipediaPageSections.parse?.tocdata?.sections ||
      wikipediaPageSections.parse?.sections ||
      [];

    const sectionIds = sections.filter(
      (section: { line: string; index: number }) => {
        return /distribution|voix|doublage/i.test(section.line);
      },
    );

    let newVoiceActorsCount = 0;
    let newCreditsCount = 0;

    for (const section of sectionIds) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        wikipediaLangPageId,
        section.index,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const mistralURL = "https://api.mistral.ai/v1/agents/completions";
      const mistralJSONRequest = await fetch(mistralURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.mistralToken}`,
        },
        body: JSON.stringify({
          stream: false,
          messages: [
            {
              role: "user",
              content: wikitext,
            },
          ],
          agent_id:
            "ag:4785a948:20241120:extracteur-page-film-wikipedia-doubleurs:31fc70f7",
          response_format: {
            type: "json_object",
          },
        }),
      });

      if (mistralJSONRequest.status === 429) {
        throw new Error("Mistral API Rate Limited (429)");
      }

      if (!mistralJSONRequest.ok) {
        throw new Error(
          `Mistral API request failed with status ${mistralJSONRequest.status}`,
        );
      }

      const mistralJSON = await mistralJSONRequest.json();
      const mistralSuggestion = mistralJSON.choices[0]?.message?.content;
      if (!mistralSuggestion) continue;

      const mistralSuggestionJSON = JSON.parse(mistralSuggestion) as any;

      for (const entry of mistralSuggestionJSON?.items ?? []) {
        let { actor, voiceActorFirstname, voiceActorName } = entry;
        const { voiceActor } = entry as any;

        if (voiceActor && !voiceActorFirstname && !voiceActorName) {
          const parts = voiceActor.trim().split(" ");
          if (parts.length > 0) {
            voiceActorFirstname = parts[0];
            voiceActorName = parts.slice(1).join(" ");
          }
        }

        if (actor && voiceActorFirstname && voiceActorName) {
          const foundActor = movie.credits?.cast?.find(
            (cast: any) => cast.name === actor,
          );

          if (!foundActor) {
            console.log(
              `actor from wikitext "${actor}" not found in tmdb cast`,
            );
            continue;
          }

          const { id: actorId } = foundActor;

          const result = await insertVoiceActorAndWork(
            voiceActorFirstname,
            voiceActorName,
            tmdbId,
            actorId,
            tmdbType,
            entry.performance,
          );

          if (result.voiceActorResult.inserted) {
            newVoiceActorsCount++;
          }
          newCreditsCount++;
        }
      }
    }

    let imageUrl: string | undefined = undefined;
    if (movie && movie.poster_path) {
      imageUrl = buildTmdbImageUrl(movie.poster_path) || undefined;
    }

    return {
      ok: true,
      changes: newVoiceActorsCount,
      creditsAdded: newCreditsCount,
      title: mediaTitle,
      imageUrl,
    };
  } catch (error) {
    console.error("Error in prepareMedia service:", error);
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? (error as any).message || JSON.stringify(error)
          : String(error);

    return { ok: false, error: errorMsg, title: mediaTitle };
  }
}

export async function prepareGame(options: {
  igdbId: number;
}): Promise<PrepareGameResult> {
  const { igdbId } = options;
  const lang = "fr";
  let gameTitle = "Unknown title";

  try {
    const igdbClient = useIgdbClient();
    const [game, characters] = await Promise.all([
      igdbClient.getGame(igdbId),
      igdbClient.getGameCharacters(igdbId),
    ]);

    if (!game) {
      throw new Error(`IGDB game ${igdbId} not found`);
    }

    gameTitle = game.name;
    await findOrCreateDubbingProject(igdbId, "video_game");

    let newVoiceActorsCount = 0;
    let newCreditsCount = 0;

    const wikipediaCache = useWikipediaCache();
    const searchData = await wikipediaCache.searchWikidataEntities(game.name);

    if (!searchData.search || searchData.search.length === 0) {
      return {
        ok: true,
        changes: 0,
        creditsAdded: 0,
        title: gameTitle,
        imageUrl: game.cover
          ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
          : undefined,
        note: "No Wikidata entry found for this game — skipping Wikipedia extraction.",
      };
    }

    const bestMatch = searchData.search[0];
    const entityData = await wikipediaCache.getWikidataEntity(bestMatch.id);
    const entity = entityData.entities[bestMatch.id];
    const wikipediaPageTitle = entity?.sitelinks?.[lang + "wiki"]?.title;

    if (!wikipediaPageTitle) {
      return {
        ok: true,
        changes: 0,
        creditsAdded: 0,
        title: gameTitle,
        imageUrl: game.cover
          ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
          : undefined,
        note: `No French Wikipedia page found for "${game.name}".`,
      };
    }

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
      wikipediaPageTitle,
      lang,
    );

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const wikipediaLangPageId = firstPage
      ? pages[firstPage]?.pageid
      : undefined;

    if (!wikipediaLangPageId) {
      throw new Error("Could not get page ID from Wikipedia search");
    }

    const wikipediaPageSections =
      await wikipediaCache.getPageSections(wikipediaLangPageId);

    const sections =
      wikipediaPageSections.parse?.tocdata?.sections ||
      wikipediaPageSections.parse?.sections ||
      [];

    const sectionIds = sections.filter(
      (section: { line: string; index: number }) =>
        /distribution|voix|casting|doublage/i.test(section.line),
    );

    const characterMap = new Map(
      characters.map((c: any) => [c.name?.toLowerCase(), c]),
    );

    const config = useRuntimeConfig();

    for (const section of sectionIds) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        wikipediaLangPageId,
        section.index,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const mistralURL = "https://api.mistral.ai/v1/agents/completions";
      const mistralJSONRequest = await fetch(mistralURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.mistralToken}`,
        },
        body: JSON.stringify({
          stream: false,
          messages: [{ role: "user", content: wikitext }],
          agent_id:
            "ag:4785a948:20241120:extracteur-page-film-wikipedia-doubleurs:31fc70f7",
          response_format: { type: "json_object" },
        }),
      });

      if (mistralJSONRequest.status === 429) {
        throw new Error("Mistral API Rate Limited (429)");
      }
      if (!mistralJSONRequest.ok) {
        throw new Error(
          `Mistral API request failed with status ${mistralJSONRequest.status}`,
        );
      }

      const mistralJSON = await mistralJSONRequest.json();
      const mistralSuggestion = mistralJSON.choices[0]?.message?.content;
      if (!mistralSuggestion) continue;

      const mistralSuggestionJSON = JSON.parse(mistralSuggestion) as any;

      for (const entry of mistralSuggestionJSON?.items ?? []) {
        let { actor, voiceActorFirstname, voiceActorName } = entry;
        const { voiceActor } = entry as any;

        if (voiceActor && !voiceActorFirstname && !voiceActorName) {
          const parts = voiceActor.trim().split(" ");
          if (parts.length > 0) {
            voiceActorFirstname = parts[0];
            voiceActorName = parts.slice(1).join(" ");
          }
        }

        if (!actor || !voiceActorFirstname || !voiceActorName) {
          continue;
        }

        const igdbChar = characterMap.get(actor.toLowerCase());
        const actorId = igdbChar
          ? (igdbChar as any).id
          : Math.abs(
              actor
                .split("")
                .reduce(
                  (hash: number, c: string) =>
                    (hash * 31 + c.charCodeAt(0)) | 0,
                  0,
                ),
            ) + 8_000_000_000;

        const result = await insertVoiceActorAndWork(
          voiceActorFirstname,
          voiceActorName,
          igdbId,
          actorId,
          "video_game",
          entry.performance,
        );

        if (result.voiceActorResult.inserted) {
          newVoiceActorsCount++;
        }
        newCreditsCount++;
      }
    }

    return {
      ok: true,
      changes: newVoiceActorsCount,
      creditsAdded: newCreditsCount,
      title: gameTitle,
      imageUrl: game.cover
        ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
        : undefined,
    };
  } catch (error) {
    console.error("Error in prepareGame service:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: errorMsg, title: gameTitle };
  }
}
