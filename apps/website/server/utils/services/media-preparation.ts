import { z } from "zod";
import { findOrCreateDubbingProject } from "../db/dubbing-project";
import { insertVoiceActorAndWork } from "./voice-actor";
import { useWikipediaCache, useIgdbClient } from "../index";
import { buildTmdbImageUrl } from "../urls/tmdb";
import { buildIgdbImageUrl } from "../api/igdb";
import { formatLlmQuota, llmGenerateObject } from "../llm";
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
  items: z.array(
    z.object({
      actor: z.string(),
      voiceActorName: z.string(),
      voiceActorFirstname: z.string(),
      performance: z.string().nullable(),
    }),
  ),
});

export interface CheckSectionsResult {
  ok: boolean;
  title?: string;
  wikiId?: string;
  pageId?: number;
  sectionIndexes?: number[];
  wikipediaUrl?: string;
  isAdult?: boolean;
  error?: string;
}

export interface ExtractCreditsResult {
  ok: boolean;
  changes: number;
  creditsAdded: number;
  title?: string;
  imageUrl?: string;
  llmModel?: string;
  llmQuota?: string;
  note?: string;
  error?: string;
}

export interface PrepareMediaResult {
  ok: boolean;
  changes?: number;
  creditsAdded?: number;
  title?: string;
  imageUrl?: string;
  llmModel?: string;
  llmQuota?: string;
  note?: string;
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
  llmModel?: string;
  llmQuota?: string;
  note?: string;
  languages?: string[];
  wikipediaUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// 1. Check Stage (Queue 2: wiki_check) - 0 LLM Cost, Regex TOC validation
// ---------------------------------------------------------------------------

export async function checkMediaDubbingSections(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  language: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<CheckSectionsResult> {
  const { tmdbId, type, language } = options;
  let mediaTitle = "Unknown title";
  let wikiPageUrl: string | undefined = undefined;

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetch(
      `${TMDB_API_BASE}/${tmdbType}/${tmdbId}?append_to_response=external_ids`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch TMDB API: status ${response.status}`);
    }

    const movie = (await response.json()) as any;
    mediaTitle = movie.title || movie.name || "Unknown title";

    if (movie.adult === true) {
      return { ok: true, title: mediaTitle, isAdult: true };
    }

    const wikiId = movie.external_ids?.wikidata_id;
    if (!wikiId) {
      throw new Error(
        "Could not find wikidata_id associated with this TMDB ID",
      );
    }

    const wikipediaCache = useWikipediaCache();
    const entityData = await wikipediaCache.getAllSitelinksEntity(wikiId);
    const sitelinks = entityData.entities[wikiId]?.sitelinks;

    const pageTitle = sitelinks?.[sitelinkKey(language)]?.title;
    if (!pageTitle) {
      const wikidataUrl = `https://www.wikidata.org/wiki/${wikiId}`;
      throw new Error(
        `No "${language}" Wikipedia sitelink found on Wikidata (${wikidataUrl}) for "${mediaTitle}".`,
      );
    }

    wikiPageUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
      pageTitle,
      language,
    );

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

    if (!pageId) {
      throw new Error(
        `Failed to resolve Wikipedia page ID for "${pageTitle}" (${wikiPageUrl}).`,
      );
    }

    const wikipediaPageSections = await wikipediaCache.getPageSections(
      pageId,
      language,
    );

    const sections =
      wikipediaPageSections.parse?.tocdata?.sections ||
      wikipediaPageSections.parse?.sections ||
      [];

    const dubbingIndexes = await selectDubbingSections(sections);
    const matchedSectionIndexes = sections
      .filter((section: { index: number }) =>
        dubbingIndexes.includes(String(section.index)),
      )
      .map((s: { index: number }) => s.index);

    if (matchedSectionIndexes.length === 0) {
      throw new Error(
        `No voice actor / dubbing sections found on Wikipedia page: ${wikiPageUrl}`,
      );
    }

    return {
      ok: true,
      title: mediaTitle,
      wikiId,
      pageId,
      sectionIndexes: matchedSectionIndexes,
      wikipediaUrl: wikiPageUrl,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      title: mediaTitle,
      wikipediaUrl: wikiPageUrl,
      error: errorMsg,
    };
  }
}

export async function checkGameDubbingSections(options: {
  igdbId: number;
  language: string;
}): Promise<CheckSectionsResult> {
  const { igdbId, language } = options;
  let gameTitle = "Unknown title";
  let wikiPageUrl: string | undefined = undefined;

  try {
    const igdbClient = useIgdbClient();
    const game = await igdbClient.getGame(igdbId);

    if (!game) {
      throw new Error(`IGDB game ${igdbId} not found`);
    }

    gameTitle = game.name;

    const wikipediaCache = useWikipediaCache();
    const searchData = await wikipediaCache.searchWikidataEntities(
      game.name,
      "en",
    );

    if (!searchData.search || searchData.search.length === 0) {
      throw new Error(
        `No Wikidata entry found for video game "${game.name}" — skipping Wikipedia extraction.`,
      );
    }

    const bestMatch = searchData.search[0];
    const entityData = await wikipediaCache.getAllSitelinksEntity(bestMatch.id);
    const sitelinks = entityData.entities[bestMatch.id]?.sitelinks;

    const pageTitle = sitelinks?.[sitelinkKey(language)]?.title;
    if (!pageTitle) {
      const wikidataUrl = `https://www.wikidata.org/wiki/${bestMatch.id}`;
      throw new Error(
        `No "${language}" Wikipedia sitelink found on Wikidata (${wikidataUrl}) for "${gameTitle}".`,
      );
    }

    wikiPageUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
      pageTitle,
      language,
    );

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

    if (!pageId) {
      throw new Error(
        `Failed to resolve Wikipedia page ID for "${pageTitle}" (${wikiPageUrl}).`,
      );
    }

    const wikipediaPageSections = await wikipediaCache.getPageSections(
      pageId,
      language,
    );

    const sections =
      wikipediaPageSections.parse?.tocdata?.sections ||
      wikipediaPageSections.parse?.sections ||
      [];

    const dubbingIndexes = await selectDubbingSections(sections);
    const matchedSectionIndexes = sections
      .filter((section: { index: number }) =>
        dubbingIndexes.includes(String(section.index)),
      )
      .map((s: { index: number }) => s.index);

    if (matchedSectionIndexes.length === 0) {
      throw new Error(
        `No voice actor / dubbing sections found on Wikipedia page: ${wikiPageUrl}`,
      );
    }

    return {
      ok: true,
      title: gameTitle,
      wikiId: bestMatch.id,
      pageId,
      sectionIndexes: matchedSectionIndexes,
      wikipediaUrl: wikiPageUrl,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      title: gameTitle,
      wikipediaUrl: wikiPageUrl,
      error: errorMsg,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Extract Stage (Queue 3: wiki_extract) - LLM Gemini credit parsing
// ---------------------------------------------------------------------------

export async function extractMediaDubbingCredits(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  language: string;
  pageId: number;
  sectionIndexes: number[];
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<ExtractCreditsResult> {
  const { tmdbId, type, language, pageId, sectionIndexes } = options;
  let mediaTitle = "Unknown title";
  let imageUrl: string | undefined = undefined;

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetch(
      `${TMDB_API_BASE}/${tmdbType}/${tmdbId}?append_to_response=credits`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const movie = (await response.json()) as any;
      mediaTitle = movie.title || movie.name || "Unknown title";
      if (movie.poster_path) {
        imageUrl = buildTmdbImageUrl(movie.poster_path) || undefined;
      }
    }

    // Cache localized cast lookups per language edition
    const langCastCache = new Map<string, any[]>();
    const getLangCast = async (l: string) => {
      if (!langCastCache.has(l)) {
        langCastCache.set(l, await fetchTmdbCredits(tmdbType, tmdbId, l));
      }
      return langCastCache.get(l)!;
    };

    await findOrCreateDubbingProject(tmdbId, tmdbType, language);

    const wikipediaCache = useWikipediaCache();
    let totalNewVoiceActors = 0;
    let totalNewCredits = 0;

    let llmModel: string | undefined;
    let llmQuota: string | undefined;
    for (const sectionIndex of sectionIndexes) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        pageId,
        String(sectionIndex),
        language,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const llmResult = await llmGenerateObject(
        wikitext,
        dubbingExtractionSchema,
        {
          systemInstruction: `You are an expert at extracting dubbing data from Wikipedia pages. Extract the dubbing (distribution) data from the provided wikitext.

Each row in a dubbing table = one credit. Output fields:
- actor: the original/previous performer (the person who originally played the role)
- voiceActorName: the localized/new voice actor's family/surname (e.g. "唐沢" for 唐沢寿明)
- voiceActorFirstname: the localized/new voice actor's given name (e.g. "寿明" for 唐沢寿明)
- performance: the character name (or null if not found)

If no dubbing or voice-actor data exists in the section, return { items: [] }.`,
          temperature: 0,
        },
      );
      llmModel = llmResult.model;
      llmQuota = formatLlmQuota(llmResult.usage) ?? llmQuota;

      for (const entry of llmResult.data?.items ?? []) {
        let { actor, voiceActorFirstname, voiceActorName } = entry;

        if (actor && voiceActorFirstname && voiceActorName) {
          const langCast = await getLangCast(language);
          const castPool = langCast.length ? langCast : [];

          const targetActorNorm = normalizeString(actor);
          const targetPerfNorm = entry.performance
            ? normalizeString(entry.performance)
            : null;

          const foundActor = castPool.find((cast: any) => {
            if (cast.name === actor) return true;
            if (normalizeString(cast.name) === targetActorNorm) return true;
            if (
              cast.original_name &&
              normalizeString(cast.original_name) === targetActorNorm
            )
              return true;
            if (
              targetPerfNorm &&
              cast.character &&
              normalizeString(cast.character) === targetPerfNorm
            )
              return true;
            if (
              cast.character &&
              normalizeString(cast.character) === targetActorNorm
            )
              return true;
            return false;
          });

          if (!foundActor) {
            console.log(
              `actor from wikitext "${actor}" not found in tmdb cast (lang ${language})`,
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
            language,
            entry.performance || undefined,
          );

          if (result.voiceActorResult.inserted) {
            totalNewVoiceActors++;
          }
          totalNewCredits++;
        }
      }

      if (llmResult.data?.items?.length === 0) {
        console.log(
          `[${llmResult.model}] No dubbing entries found in section ${sectionIndex} for "${mediaTitle}"`,
        );
      }
    }

    return {
      ok: true,
      changes: totalNewVoiceActors,
      creditsAdded: totalNewCredits,
      title: mediaTitle,
      imageUrl,
      llmModel,
      llmQuota,
      note:
        totalNewCredits === 0
          ? `No dubbing entries matched (LLM: ${llmModel || "unknown"}${llmQuota ? `, quota: ${llmQuota}` : ""}). Check if Wikipedia has dubbing tables for ${language}.`
          : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      title: mediaTitle,
      imageUrl,
      error: errorMsg,
    };
  }
}

export async function extractGameDubbingCredits(options: {
  igdbId: number;
  language: string;
  pageId: number;
  sectionIndexes: number[];
}): Promise<ExtractCreditsResult> {
  const { igdbId, language, pageId, sectionIndexes } = options;
  let gameTitle = "Unknown title";
  let imageUrl: string | undefined = undefined;

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
    if (game.cover) {
      imageUrl =
        buildIgdbImageUrl(game.cover.image_id, "cover_big") || undefined;
    }

    const characterMap = new Map(
      characters.map((c: any) => [c.name?.toLowerCase(), c]),
    );

    const wikipediaCache = useWikipediaCache();
    let totalNewVoiceActors = 0;
    let totalNewCredits = 0;

    let llmModel: string | undefined;
    let llmQuota: string | undefined;
    for (const sectionIndex of sectionIndexes) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        pageId,
        String(sectionIndex),
        language,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const llmResult = await llmGenerateObject(
        wikitext,
        dubbingExtractionSchema,
        {
          systemInstruction: `You are an expert at extracting dubbing data from Wikipedia pages. Extract the dubbing (distribution) data from the provided wikitext.

Each row in a dubbing table = one credit. Output fields:
- actor: the original/previous performer (the person who originally played the role)
- voiceActorName: the localized/new voice actor's family/surname (e.g. "唐沢" for 唐沢寿明)
- voiceActorFirstname: the localized/new voice actor's given name (e.g. "寿明" for 唐沢寿明)
- performance: the character name (or null if not found)

If no dubbing or voice-actor data exists in the section, return { items: [] }.`,
          temperature: 0,
        },
      );
      llmModel = llmResult.model;
      llmQuota = formatLlmQuota(llmResult.usage) ?? llmQuota;

      for (const entry of llmResult.data?.items ?? []) {
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
          language,
          entry.performance || undefined,
        );

        if (result.voiceActorResult.inserted) {
          totalNewVoiceActors++;
        }
        totalNewCredits++;
      }

      if (llmResult.data?.items?.length === 0) {
        console.log(
          `[${llmResult.model}] No dubbing entries found in section ${sectionIndex} for "${gameTitle}"`,
        );
      }
    }

    return {
      ok: true,
      changes: totalNewVoiceActors,
      creditsAdded: totalNewCredits,
      title: gameTitle,
      imageUrl,
      llmModel,
      llmQuota,
      note:
        totalNewCredits === 0
          ? `No dubbing entries matched (LLM: ${llmModel || "unknown"}${llmQuota ? `, quota: ${llmQuota}` : ""}). Check if Wikipedia has dubbing tables for ${language}.`
          : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      title: gameTitle,
      imageUrl,
      error: errorMsg,
    };
  }
}

// ---------------------------------------------------------------------------
// High-Level Full Preparation Wrappers (for manual / instant UI execution)
// ---------------------------------------------------------------------------

export async function prepareMedia(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  language?: string | null;
}): Promise<PrepareMediaResult> {
  const { tmdbId, type, language } = options;
  if (!language) {
    throw new Error("Direct prepareMedia requires a specified language.");
  }

  const check = await checkMediaDubbingSections({
    tmdbId,
    type,
    language,
    seasonNumber: options.seasonNumber,
    episodeNumber: options.episodeNumber,
  });

  if (!check.ok) {
    return {
      ok: false,
      title: check.title,
      wikipediaUrl: check.wikipediaUrl,
      error: check.error,
    };
  }

  if (check.isAdult) {
    return { ok: true, title: check.title, changes: 0, creditsAdded: 0 };
  }

  const extract = await extractMediaDubbingCredits({
    tmdbId,
    type,
    language,
    pageId: check.pageId!,
    sectionIndexes: check.sectionIndexes!,
    seasonNumber: options.seasonNumber,
    episodeNumber: options.episodeNumber,
  });

  return {
    ok: extract.ok,
    changes: extract.changes,
    creditsAdded: extract.creditsAdded,
    title: extract.title || check.title,
    imageUrl: extract.imageUrl,
    llmModel: extract.llmModel,
    llmQuota: extract.llmQuota,
    note: extract.note,
    wikipediaUrl: check.wikipediaUrl,
    languages: [language],
    error: extract.error,
  };
}

export async function prepareGame(options: {
  igdbId: number;
  language?: string | null;
}): Promise<PrepareGameResult> {
  const { igdbId, language } = options;
  if (!language) {
    throw new Error("Direct prepareGame requires a specified language.");
  }

  const check = await checkGameDubbingSections({ igdbId, language });
  if (!check.ok) {
    return {
      ok: false,
      title: check.title,
      wikipediaUrl: check.wikipediaUrl,
      error: check.error,
    };
  }

  const extract = await extractGameDubbingCredits({
    igdbId,
    language,
    pageId: check.pageId!,
    sectionIndexes: check.sectionIndexes!,
  });

  return {
    ok: extract.ok,
    changes: extract.changes,
    creditsAdded: extract.creditsAdded,
    title: extract.title || check.title,
    imageUrl: extract.imageUrl,
    llmModel: extract.llmModel,
    llmQuota: extract.llmQuota,
    note: extract.note,
    wikipediaUrl: check.wikipediaUrl,
    languages: [language],
    error: extract.error,
  };
}
