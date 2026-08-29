import { z } from "zod";
import { findOrCreateDubbingProject } from "../db/dubbing-project";
import { insertVoiceActorAndWork } from "./voice-actor";
import { useWikipediaCache, useIgdbClient } from "../index";
import { buildTmdbImageUrl } from "../urls/tmdb";
import { buildIgdbImageUrl } from "../api/igdb";
import { llmGenerateObject } from "../llm";
import {
  extractAvailableLanguages,
  selectDubbingSections,
  sitelinkKey,
} from "../cache/wikipedia";

const MAX_LANGUAGES_PER_REQUEST = 15;

const TMDB_API_BASE = "https://api.themoviedb.org/3";

/** Map a Wikipedia language code to a TMDB ISO 639-1 (-3166) code. */
function tmdbLang(lang: string): string {
  if (lang === "simple") return "en";
  if (lang.includes("-")) {
    const parts = lang.split("-");
    const region = parts[1];
    return region ? `${parts[0]}-${region.toUpperCase()}` : (parts[0] ?? lang);
  }
  return lang;
}

/** Fetch a movie/tv's credits for a given TMDB language (Latin fallback). */
async function fetchTmdbCredits(
  tmdbType: string,
  tmdbId: number,
  lang: string,
): Promise<any[]> {
  const config = useRuntimeConfig();
  const url = `${TMDB_API_BASE}/${tmdbType}/${tmdbId}/credits?language=${encodeURIComponent(
    tmdbLang(lang),
  )}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tmdbApiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return data.cast || [];
  } catch {
    return [];
  }
}

const dubbingExtractionSchema = z.object({
  items: z
    .array(
      z.object({
        actor: z.string(),
        voiceActorName: z.string(),
        voiceActorFirstname: z.string(),
        performance: z.string().optional(),
      }),
    )
    .optional(),
});

export interface PrepareMediaResult {
  ok: boolean;
  changes?: number;
  creditsAdded?: number;
  title?: string;
  imageUrl?: string;
  languages?: string[];
  wikipediaUrl?: string;
  error?: string;
}

export interface PrepareGameResult {
  ok: boolean;
  changes?: number;
  creditsAdded?: number;
  title?: string;
  imageUrl?: string;
  note?: string;
  languages?: string[];
  wikipediaUrl?: string;
  error?: string;
}

export async function prepareMedia(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  language?: string | null;
}): Promise<PrepareMediaResult> {
  const { tmdbId, type, language } = options;
  let mediaTitle = "Unknown title";
  let lastCheckedWikiUrl: string | undefined = undefined;

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?append_to_response=credits,external_ids`,
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

    if (movie.adult === true) {
      console.log(
        `[PREPARE] Skipping 18+ adult media ${type} ${tmdbId}: ${mediaTitle}`,
      );
      return {
        ok: true,
        title: mediaTitle,
        changes: 0,
        creditsAdded: 0,
      };
    }

    const wikiId = movie.external_ids?.wikidata_id;
    if (!wikiId) {
      throw new Error(
        "Could not find wikidata_id associated with this TMDB ID",
      );
    }

    const wikipediaCache = useWikipediaCache();
    let sitelinks: Record<string, any> | undefined;
    let availableLanguages: string[] = [];

    if (language) {
      // Single-language mode: only process the requested language
      availableLanguages = [language];
      const entityData = await wikipediaCache.getAllSitelinksEntity(wikiId);
      sitelinks = entityData.entities[wikiId]?.sitelinks;
    } else {
      // Discovery mode: find all available languages
      const entityData = await wikipediaCache.getAllSitelinksEntity(wikiId);
      sitelinks = entityData.entities[wikiId]?.sitelinks;
      availableLanguages = extractAvailableLanguages(sitelinks);
    }

    console.log("availableLanguages", availableLanguages);

    if (availableLanguages.length === 0) {
      return {
        ok: true,
        changes: 0,
        creditsAdded: 0,
        title: mediaTitle,
        imageUrl: movie.poster_path
          ? buildTmdbImageUrl(movie.poster_path) || undefined
          : undefined,
        languages: [],
      };
    }

    let totalNewVoiceActors = 0;
    let totalNewCredits = 0;
    const processedLanguages: string[] = [];
    const creditsCache = new Map<string, any[]>();

    const getLangCast = async (lang: string): Promise<any[]> => {
      const cached = creditsCache.get(lang);
      if (cached) return cached;
      const fetched = await fetchTmdbCredits(tmdbType, tmdbId, lang);
      creditsCache.set(lang, fetched);
      return fetched;
    };

    if (!sitelinks) {
      throw new Error("No sitelinks found for this media.");
    }

    // When processing a specific language (queue job), don't apply the limit
    const languagesToProcess = language
      ? availableLanguages
      : availableLanguages.slice(0, MAX_LANGUAGES_PER_REQUEST);

    for (const lang of languagesToProcess) {
      const pageTitle = sitelinks[sitelinkKey(lang)]?.title;
      if (!pageTitle) continue;

      const wikiPageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
      lastCheckedWikiUrl = wikiPageUrl;

      console.log(
        `Checking language "${lang}" for page "${pageTitle}" (${wikiPageUrl})`,
      );

      const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
        pageTitle,
        lang,
      );

      const pages = wikipediaPage?.query?.pages || {};
      const firstPage = Object.keys(pages)[0];
      const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

      if (!pageId) continue;

      const wikipediaPageSections = await wikipediaCache.getPageSections(
        pageId,
        lang,
      );

      const sections =
        wikipediaPageSections.parse?.tocdata?.sections ||
        wikipediaPageSections.parse?.sections ||
        [];

      const dubbingIndexes = await selectDubbingSections(sections);
      const sectionIds = sections.filter((section: { index: number }) =>
        dubbingIndexes.includes(String(section.index)),
      );

      if (sectionIds.length === 0) {
        console.log(
          `No matching sections found in "${lang}" Wikipedia (${wikiPageUrl}), skipping`,
        );
        continue;
      }

      console.log(
        `Processing ${sectionIds.length} section(s) in "${lang}" Wikipedia`,
      );

      await findOrCreateDubbingProject(tmdbId, tmdbType, lang);

      let langNewVoiceActors = 0;
      let langNewCredits = 0;

      for (const section of sectionIds) {
        const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
          pageId,
          section.index,
          lang,
        );
        const wikitext = wikitextJSON.parse?.wikitext;
        if (!wikitext) continue;

        const llmSuggestionJSON = await llmGenerateObject(
          wikitext,
          dubbingExtractionSchema,
          {
            systemInstruction: `You are an expert at extracting dubbing data from Wikipedia pages. Extract the dubbing (distribution) data from the provided wikitext.

Each row in a dubbing table = one credit. Output fields:
- actor: the original/previous performer (the person who originally played the role)
- voiceActorName: the localized/new voice actor's family/surname (e.g. "唐沢" for 唐沢寿明)
- voiceActorFirstname: the localized/new voice actor's given name (e.g. "寿明" for 唐沢寿明)
- performance: the character name (optional)

If no dubbing or voice-actor data exists in the section, return { items: [] }.

Example (Japanese):
Input wikitext:
{| class="wikitable"
! キャラクター !! 初代俳優 !! 声優
|-
| ウッディ || トム・ハンクス || 唐沢寿明
|-
| バズ・ライトイヤー || ティム・アレン || 落合弘治
|}
Output:
{ "items": [
  { "actor": "トム・ハンクス", "voiceActorName": "唐沢", "voiceActorFirstname": "寿明", "performance": "ウッディ" },
  { "actor": "ティム・アレン", "voiceActorName": "落合", "voiceActorFirstname": "弘治", "performance": "バズ・ライトイヤー" }
]}

Example (English):
Input wikitext:
{| class="wikitable"
! Character !! Original Actor !! Voice Actor
|-
| Woody || Tom Hanks || Tom Hanks
|}
Output:
{ "items": [
  { "actor": "Tom Hanks", "voiceActorName": "Hanks", "voiceActorFirstname": "Tom", "performance": "Woody" }
]}`,
            temperature: 0,
          },
        );

        for (const entry of llmSuggestionJSON?.items ?? []) {
          let { actor, voiceActorFirstname, voiceActorName } = entry;

          if (actor && voiceActorFirstname && voiceActorName) {
            // Prefer this edition's localized cast names, fall back to the
            // default (English/Latin) credits so non-latin editions still link.
            const langCast = await getLangCast(lang);
            const castPool = langCast.length
              ? langCast
              : movie.credits?.cast || [];

            const foundActor = castPool.find(
              (cast: any) => cast.name === actor,
            );

            if (!foundActor) {
              console.log(
                `actor from wikitext "${actor}" not found in tmdb cast (lang ${lang})`,
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
              lang,
              entry.performance,
            );

            if (result.voiceActorResult.inserted) {
              langNewVoiceActors++;
            }
            langNewCredits++;
          }
        }
      }

      console.log(
        `"${lang}": ${langNewCredits} credits, ${langNewVoiceActors} new voice actors`,
      );
      totalNewVoiceActors += langNewVoiceActors;
      totalNewCredits += langNewCredits;
      if (langNewCredits > 0) {
        processedLanguages.push(lang);
      }
    }

    if (processedLanguages.length === 0) {
      const wikiUrlInfo = lastCheckedWikiUrl
        ? ` on Wikipedia page: ${lastCheckedWikiUrl}`
        : "";
      throw new Error(
        `No voice actor / dubbing sections found${wikiUrlInfo}. ` +
          `Checked ${availableLanguages.length} language(s): ${availableLanguages.join(", ")}.`,
      );
    }

    let imageUrl: string | undefined = undefined;
    if (movie && movie.poster_path) {
      imageUrl = buildTmdbImageUrl(movie.poster_path) || undefined;
    }

    return {
      ok: true,
      changes: totalNewVoiceActors,
      creditsAdded: totalNewCredits,
      title: mediaTitle,
      imageUrl,
      languages: processedLanguages,
      wikipediaUrl: lastCheckedWikiUrl,
    };
  } catch (error) {
    console.error("Error in prepareMedia service:", error);
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? (error as any).message || JSON.stringify(error)
          : String(error);

    return {
      ok: false,
      error: errorMsg,
      title: mediaTitle,
      wikipediaUrl: lastCheckedWikiUrl,
    };
  }
}

export async function prepareGame(options: {
  igdbId: number;
  language?: string | null;
}): Promise<PrepareGameResult> {
  const { igdbId, language } = options;
  let gameTitle = "Unknown title";
  let lastCheckedWikiUrl: string | undefined = undefined;

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

    let newVoiceActorsCount = 0;
    let newCreditsCount = 0;

    const wikipediaCache = useWikipediaCache();
    const searchData = await wikipediaCache.searchWikidataEntities(
      game.name,
      "en",
    );

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

    // When language is provided, process only that language (per-language queue job)
    // When language is null, discover all available languages
    let availableLanguages: string[];
    let sitelinks: Record<string, any> | undefined;

    if (language) {
      // Single language mode: skip sitelink discovery, use provided language
      availableLanguages = [language];
      const entityData = await wikipediaCache.getAllSitelinksEntity(
        bestMatch.id,
      );
      sitelinks = entityData.entities[bestMatch.id]?.sitelinks;
    } else {
      // Discovery mode: find all available languages
      const entityData = await wikipediaCache.getAllSitelinksEntity(
        bestMatch.id,
      );
      sitelinks = entityData.entities[bestMatch.id]?.sitelinks;
      availableLanguages = extractAvailableLanguages(sitelinks);
    }

    console.log("availableLanguages", availableLanguages);

    if (availableLanguages.length === 0) {
      return {
        ok: true,
        changes: 0,
        creditsAdded: 0,
        title: gameTitle,
        imageUrl: game.cover
          ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
          : undefined,
        note: `No Wikipedia pages found for "${game.name}".`,
      };
    }

    const characterMap = new Map(
      characters.map((c: any) => [c.name?.toLowerCase(), c]),
    );

    const processedLanguages: string[] = [];

    if (!sitelinks) {
      throw new Error("No sitelinks found for this game.");
    }

    // When processing a specific language (queue job), don't apply the limit
    const languagesToProcess = language
      ? availableLanguages
      : availableLanguages.slice(0, MAX_LANGUAGES_PER_REQUEST);

    for (const lang of languagesToProcess) {
      const pageTitle = sitelinks[sitelinkKey(lang)]?.title;
      if (!pageTitle) continue;

      const wikiPageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
      lastCheckedWikiUrl = wikiPageUrl;

      console.log(
        `Checking language "${lang}" for page "${pageTitle}" (${wikiPageUrl})`,
      );

      const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
        pageTitle,
        lang,
      );

      const pages = wikipediaPage?.query?.pages || {};
      const firstPage = Object.keys(pages)[0];
      const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

      if (!pageId) continue;

      const wikipediaPageSections = await wikipediaCache.getPageSections(
        pageId,
        lang,
      );

      const sections =
        wikipediaPageSections.parse?.tocdata?.sections ||
        wikipediaPageSections.parse?.sections ||
        [];

      const dubbingIndexes = await selectDubbingSections(sections);
      const sectionIds = sections.filter((section: { index: number }) =>
        dubbingIndexes.includes(String(section.index)),
      );

      if (sectionIds.length === 0) {
        console.log(
          `No matching sections found in "${lang}" Wikipedia (${wikiPageUrl}), skipping`,
        );
        continue;
      }

      console.log(
        `Processing ${sectionIds.length} section(s) in "${lang}" Wikipedia`,
      );

      let langNewVoiceActors = 0;
      let langNewCredits = 0;

      for (const section of sectionIds) {
        const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
          pageId,
          section.index,
          lang,
        );
        const wikitext = wikitextJSON.parse?.wikitext;
        if (!wikitext) continue;

        const llmSuggestionJSON = await llmGenerateObject(
          wikitext,
          dubbingExtractionSchema,
          {
            systemInstruction: `You are an expert at extracting dubbing data from Wikipedia pages. Extract the dubbing (distribution) data from the provided wikitext.

Each row in a dubbing table = one credit. Output fields:
- actor: the original/previous performer (the person who originally played the role)
- voiceActorName: the localized/new voice actor's family/surname (e.g. "唐沢" for 唐沢寿明)
- voiceActorFirstname: the localized/new voice actor's given name (e.g. "寿明" for 唐沢寿明)
- performance: the character name (optional)

If no dubbing or voice-actor data exists in the section, return { items: [] }.

Example (Japanese):
Input wikitext:
{| class="wikitable"
! キャラクター !! 初代俳優 !! 声優
|-
| ウッディ || トム・ハンクス || 唐沢寿明
|-
| バズ・ライトイヤー || ティム・アレン || 落合弘治
|}
Output:
{ "items": [
  { "actor": "トム・ハンクス", "voiceActorName": "唐沢", "voiceActorFirstname": "寿明", "performance": "ウッディ" },
  { "actor": "ティム・アレン", "voiceActorName": "落合", "voiceActorFirstname": "弘治", "performance": "バズ・ライトイヤー" }
]}

Example (English):
Input wikitext:
{| class="wikitable"
! Character !! Original Actor !! Voice Actor
|-
| Woody || Tom Hanks || Tom Hanks
|}
Output:
{ "items": [
  { "actor": "Tom Hanks", "voiceActorName": "Hanks", "voiceActorFirstname": "Tom", "performance": "Woody" }
]}`,
            temperature: 0,
          },
        );

        for (const entry of llmSuggestionJSON?.items ?? []) {
          let { actor, voiceActorFirstname, voiceActorName } = entry;

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
            lang,
            entry.performance,
          );

          if (result.voiceActorResult.inserted) {
            langNewVoiceActors++;
          }
          langNewCredits++;
        }
      }

      console.log(
        `"${lang}": ${langNewCredits} credits, ${langNewVoiceActors} new voice actors`,
      );
      newVoiceActorsCount += langNewVoiceActors;
      newCreditsCount += langNewCredits;
      if (langNewCredits > 0) {
        processedLanguages.push(lang);
      }
    }

    if (processedLanguages.length === 0) {
      const wikiUrlInfo = lastCheckedWikiUrl
        ? ` on Wikipedia page: ${lastCheckedWikiUrl}`
        : "";
      throw new Error(
        `No voice actor / dubbing sections found${wikiUrlInfo}. ` +
          `Checked ${availableLanguages.length} language(s): ${availableLanguages.join(", ")}.`,
      );
    }

    return {
      ok: true,
      changes: newVoiceActorsCount,
      creditsAdded: newCreditsCount,
      title: gameTitle,
      imageUrl: game.cover
        ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
        : undefined,
      languages: processedLanguages,
      wikipediaUrl: lastCheckedWikiUrl,
    };
  } catch (error) {
    console.error("Error in prepareGame service:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: errorMsg,
      title: gameTitle,
      wikipediaUrl: lastCheckedWikiUrl,
    };
  }
}
