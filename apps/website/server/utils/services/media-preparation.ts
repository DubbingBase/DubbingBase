import { isDubbingLanguage, displayDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";
import { z } from "zod";
import { getErrorMessage } from "../error-message";
import {
  createMediaResponseError,
  fetchMediaRequest,
  isRetryableMediaRequestError,
} from "../retryable-request";
import { insertVoiceActorAndWork } from "./voice-actor";
import { useWikipediaCache, useIgdbClient } from "../index";
import type { SimpleCache } from "../cache";
import { buildTmdbImageUrl } from "../urls/tmdb";
import { buildIgdbImageUrl } from "../api/igdb";
import { llmGenerateObject } from "../llm";
import {
  selectDubbingCandidateSections,
  filterValidSectionIndexes,
  sitelinkKey,
  type DubbingSectionCandidate,
} from "../cache/wikipedia";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

interface TmdbMediaDetails {
  title?: string | null;
  name?: string | null;
  adult?: boolean | null;
  poster_path?: string | null;
  external_ids?: { wikidata_id?: string | null } | null;
}

interface TmdbCastMember {
  id: number;
  name?: string;
  original_name?: string;
  character?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTmdbMediaDetails(value: unknown): value is TmdbMediaDetails {
  if (!isRecord(value)) return false;
  const externalIds = value.external_ids;
  return (
    (value.title === undefined || value.title === null || typeof value.title === "string") &&
    (value.name === undefined || value.name === null || typeof value.name === "string") &&
    (value.adult === undefined || value.adult === null || typeof value.adult === "boolean") &&
    (value.poster_path === undefined ||
      value.poster_path === null ||
      typeof value.poster_path === "string") &&
    (externalIds === undefined ||
      externalIds === null ||
      (isRecord(externalIds) &&
        (externalIds.wikidata_id === undefined ||
          externalIds.wikidata_id === null ||
          typeof externalIds.wikidata_id === "string")))
  );
}

function isTmdbCastMember(value: unknown): value is TmdbCastMember {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.original_name === undefined || typeof value.original_name === "string") &&
    (value.character === undefined || typeof value.character === "string")
  );
}

function requireWikipediaSections(response: {
  parse?: {
    tocdata?: { sections?: Array<{ index: number; line: string }> };
    sections?: Array<{ index: number; line: string }>;
  };
}): Array<{ index: number; line: string }> {
  const sections = response.parse?.tocdata?.sections ?? response.parse?.sections;
  if (!Array.isArray(sections)) {
    throw new Error("Wikipedia returned an invalid section list response");
  }
  return sections;
}

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
): Promise<TmdbCastMember[]> {
  const config = useRuntimeConfig();
  const url = `${TMDB_API_BASE}/${tmdbType}/${tmdbId}/credits?language=${encodeURIComponent(
    tmdbLang(lang),
  )}`;
  const res = await fetchMediaRequest(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.tmdbApiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw createMediaResponseError("TMDB", res);
  const data: unknown = await res.json();
  return isRecord(data) && Array.isArray(data.cast) ? data.cast.filter(isTmdbCastMember) : [];
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

const dubbingExtractionSystemInstruction = `You are an expert at extracting dubbing data from Wikipedia pages. Extract the dubbing (distribution) data from the provided wikitext.

Each row in a dubbing table = one credit. Output fields:
- actor: the original/previous performer (the person who originally played the role)
- voiceActorName: the localized/new voice actor's family/surname (e.g. "唐沢" for 唐沢寿明)
- voiceActorFirstname: the localized/new voice actor's given name (e.g. "寿明" for 唐沢寿明)
- performance: the character name (or null if not found)

Skip any row where the voice actor name is not an exploitable person name (e.g. "N/A", "?", unknown or placeholder/dash-only) — omit it from items. Keep original spelling exactly, preserving accents/diacritics and hyphens/dashes.

If no dubbing or voice-actor data exists in the section, return { items: [] }.`;

export interface CheckSectionsResult {
  ok: boolean;
  title?: string;
  wikiId?: string;
  pageId?: number;
  sectionIndexes?: number[];
  sectionCandidates?: DubbingSectionCandidate[];
  wikipediaUrl?: string;
  isAdult?: boolean;
  error?: string;
  retryable?: boolean;
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
  retryable?: boolean;
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

/** Finds dubbing sections on a Wikipedia page linked to TMDB media. */
export async function checkMediaDubbingSections(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  wikipediaLanguage: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  cache?: SimpleCache;
}): Promise<CheckSectionsResult> {
  const { tmdbId, type, wikipediaLanguage, cache } = options;
  let mediaTitle = "Unknown title";
  let wikiPageUrl: string | undefined = undefined;

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetchMediaRequest(
      `${TMDB_API_BASE}/${tmdbType}/${tmdbId}?append_to_response=external_ids`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      throw createMediaResponseError("TMDB", response);
    }

    const movieData: unknown = await response.json();
    if (!isTmdbMediaDetails(movieData)) {
      throw new Error("TMDB returned invalid media details");
    }
    const movie = movieData;
    mediaTitle = movie.title || movie.name || "Unknown title";

    if (movie.adult === true) {
      return { ok: true, title: mediaTitle, isAdult: true };
    }

    const wikiId = movie.external_ids?.wikidata_id;
    if (!wikiId) {
      throw new Error("Could not find wikidata_id associated with this TMDB ID");
    }

    const wikipediaCache = useWikipediaCache(cache);
    const entityData = await wikipediaCache.getAllSitelinksEntity(wikiId);
    const sitelinks = entityData.entities[wikiId]?.sitelinks;

    const pageTitle = sitelinks?.[sitelinkKey(wikipediaLanguage)]?.title;
    if (!pageTitle) {
      const wikidataUrl = `https://www.wikidata.org/wiki/${wikiId}`;
      throw new Error(
        `No "${wikipediaLanguage}" Wikipedia sitelink found on Wikidata (${wikidataUrl}) for "${mediaTitle}".`,
      );
    }

    wikiPageUrl = `https://${wikipediaLanguage}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(pageTitle, wikipediaLanguage);

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

    if (!pageId) {
      throw new Error(`Failed to resolve Wikipedia page ID for "${pageTitle}" (${wikiPageUrl}).`);
    }

    const wikipediaPageSections = await wikipediaCache.getPageSections(pageId, wikipediaLanguage);

    const sections = requireWikipediaSections(wikipediaPageSections);

    const sectionCandidates = await selectDubbingCandidateSections(sections);
    const matchedSectionIndexes = sectionCandidates.map((candidate) => candidate.index);

    return {
      ok: true,
      title: mediaTitle,
      wikiId,
      pageId,
      sectionIndexes: matchedSectionIndexes,
      sectionCandidates,
      wikipediaUrl: wikiPageUrl,
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    return {
      ok: false,
      title: mediaTitle,
      wikipediaUrl: wikiPageUrl,
      error: errorMsg,
      retryable: isRetryableMediaRequestError(error),
    };
  }
}

/** Finds dubbing sections on a Wikipedia page linked to an IGDB game. */
export async function checkGameDubbingSections(options: {
  igdbId: number;
  wikipediaLanguage: string;
  cache?: SimpleCache;
}): Promise<CheckSectionsResult> {
  const { igdbId, wikipediaLanguage, cache } = options;
  let gameTitle = "Unknown title";
  let wikiPageUrl: string | undefined = undefined;

  try {
    const igdbClient = useIgdbClient(cache);
    const game = await igdbClient.getGame(igdbId);

    if (!game) {
      throw new Error(`IGDB game ${igdbId} not found`);
    }

    gameTitle = game.name;

    const wikipediaCache = useWikipediaCache(cache);
    const searchData = await wikipediaCache.searchWikidataEntities(game.name, "en");

    if (!searchData.search || searchData.search.length === 0) {
      throw new Error(
        `No Wikidata entry found for video game "${game.name}" — skipping Wikipedia extraction.`,
      );
    }

    const bestMatch = searchData.search[0];
    if (!bestMatch) {
      throw new Error(`No Wikidata entry found for video game "${game.name}".`);
    }
    const entityData = await wikipediaCache.getAllSitelinksEntity(bestMatch.id);
    const sitelinks = entityData.entities[bestMatch.id]?.sitelinks;

    const pageTitle = sitelinks?.[sitelinkKey(wikipediaLanguage)]?.title;
    if (!pageTitle) {
      const wikidataUrl = `https://www.wikidata.org/wiki/${bestMatch.id}`;
      throw new Error(
        `No "${wikipediaLanguage}" Wikipedia sitelink found on Wikidata (${wikidataUrl}) for "${gameTitle}".`,
      );
    }

    wikiPageUrl = `https://${wikipediaLanguage}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

    const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(pageTitle, wikipediaLanguage);

    const pages = wikipediaPage?.query?.pages || {};
    const firstPage = Object.keys(pages)[0];
    const pageId = firstPage ? pages[firstPage]?.pageid : undefined;

    if (!pageId) {
      throw new Error(`Failed to resolve Wikipedia page ID for "${pageTitle}" (${wikiPageUrl}).`);
    }

    const wikipediaPageSections = await wikipediaCache.getPageSections(pageId, wikipediaLanguage);

    const sections = requireWikipediaSections(wikipediaPageSections);

    const sectionCandidates = await selectDubbingCandidateSections(sections);
    const matchedSectionIndexes = sectionCandidates.map((candidate) => candidate.index);

    return {
      ok: true,
      title: gameTitle,
      wikiId: bestMatch.id,
      pageId,
      sectionIndexes: matchedSectionIndexes,
      sectionCandidates,
      wikipediaUrl: wikiPageUrl,
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    return {
      ok: false,
      title: gameTitle,
      wikipediaUrl: wikiPageUrl,
      error: errorMsg,
      retryable: isRetryableMediaRequestError(error),
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Extract Stage (Queue 3: wiki_extract) - LLM Gemini credit parsing
// ---------------------------------------------------------------------------

/** Extracts credits from selected Wikipedia sections for a TMDB media item. */
export async function extractMediaDubbingCredits(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  wikipediaLanguage: string;
  dubbingLanguage?: DubbingLanguage;
  pageId: number;
  sectionIndexes: number[];
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  cache?: SimpleCache;
}): Promise<ExtractCreditsResult> {
  const { tmdbId, type, wikipediaLanguage, pageId, sectionIndexes, cache } = options;
  let mediaTitle = "Unknown title";
  let imageUrl: string | undefined = undefined;

  const dubbingLanguage = options.dubbingLanguage;
  if (!isDubbingLanguage(dubbingLanguage)) {
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      error: "Regional dubbing language is required for extraction",
    };
  }

  try {
    const config = useRuntimeConfig();
    const tmdbType = type === "season" || type === "episode" ? "tv" : type;

    const response = await fetchMediaRequest(
      `${TMDB_API_BASE}/${tmdbType}/${tmdbId}?append_to_response=credits`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) throw createMediaResponseError("TMDB", response);

    const movieData: unknown = await response.json();
    if (!isTmdbMediaDetails(movieData)) {
      throw new Error("TMDB returned invalid media details");
    }
    const movie = movieData;
    mediaTitle = movie.title || movie.name || "Unknown title";
    if (movie.poster_path) {
      imageUrl = buildTmdbImageUrl(movie.poster_path) || undefined;
    }

    // Cache localized cast lookups per language edition
    const langCastCache = new Map<string, TmdbCastMember[]>();
    const getLangCast = async (l: string) => {
      if (!langCastCache.has(l)) {
        langCastCache.set(l, await fetchTmdbCredits(tmdbType, tmdbId, l));
      }
      return langCastCache.get(l)!;
    };

    const wikipediaCache = useWikipediaCache(cache);
    // ponytail: check and extract run on different cron ticks — drop indexes
    // that no longer match (stale payloads, e.g. bare "Reparto" enqueued pre-fix)
    const pageSections = await wikipediaCache.getPageSections(pageId, wikipediaLanguage);
    const validIndexes = await filterValidSectionIndexes(
      pageSections.parse?.tocdata?.sections || pageSections.parse?.sections || [],
      sectionIndexes,
    );
    if (validIndexes.length === 0) {
      return {
        ok: false,
        changes: 0,
        creditsAdded: 0,
        title: mediaTitle,
        imageUrl,
        error: `Stale queue element: section(s) [${sectionIndexes.join(", ")}] no longer match candidate headings on the "${wikipediaLanguage}" Wikipedia page.`,
      };
    }
    let totalNewVoiceActors = 0;
    let totalNewCredits = 0;

    let llmModel: string | undefined;
    let llmQuota: string | undefined;
    for (const sectionIndex of validIndexes) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        pageId,
        String(sectionIndex),
        wikipediaLanguage,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const llmResult = await llmGenerateObject(wikitext, dubbingExtractionSchema, {
        systemInstruction: `${dubbingExtractionSystemInstruction}

The requested target dubbing region is ${dubbingLanguage} (${displayDubbingLanguage(dubbingLanguage, "en")}). Extract only credits for this target. Exclude other regional versions and original-language casting. The Wikipedia edition is a source identifier, never evidence of the dubbing market.`,
        temperature: 0,
      });
      llmModel = llmResult.model;
      llmQuota = llmResult.quota ?? llmQuota;

      for (const entry of llmResult.data?.items ?? []) {
        let { actor, voiceActorFirstname, voiceActorName } = entry;

        if (actor && voiceActorFirstname && voiceActorName) {
          if (
            !isExploitableVoiceActorName(voiceActorFirstname) ||
            !isExploitableVoiceActorName(voiceActorName)
          ) {
            continue;
          }
          const langCast = await getLangCast(wikipediaLanguage);
          const castPool = langCast.length ? langCast : [];

          const targetActorNorm = normalizeString(actor);
          const targetPerfNorm = entry.performance ? normalizeString(entry.performance) : null;

          const foundActor = castPool.find((cast) => {
            if (cast.name === actor) return true;
            if (normalizeString(cast.name) === targetActorNorm) return true;
            if (cast.original_name && normalizeString(cast.original_name) === targetActorNorm)
              return true;
            if (
              targetPerfNorm &&
              cast.character &&
              normalizeString(cast.character) === targetPerfNorm
            )
              return true;
            if (cast.character && normalizeString(cast.character) === targetActorNorm) return true;
            return false;
          });

          if (!foundActor) {
            console.log(
              `actor from wikitext "${actor}" not found in tmdb cast (lang ${wikipediaLanguage})`,
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
            dubbingLanguage,
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
          ? `No dubbing entries matched (LLM: ${llmModel || "unknown"}). Check if Wikipedia has dubbing tables for ${wikipediaLanguage}.`
          : undefined,
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    console.error(`[media-preparation:pipe3] extractMedia failed:`, errorMsg, error);
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      title: mediaTitle,
      imageUrl,
      error: errorMsg,
      retryable: isRetryableMediaRequestError(error),
    };
  }
}

/** Extracts credits from selected Wikipedia sections for an IGDB game. */
export async function extractGameDubbingCredits(options: {
  igdbId: number;
  wikipediaLanguage: string;
  dubbingLanguage?: DubbingLanguage;
  pageId: number;
  sectionIndexes: number[];
  cache?: SimpleCache;
}): Promise<ExtractCreditsResult> {
  const { igdbId, wikipediaLanguage, pageId, sectionIndexes, cache } = options;
  let gameTitle = "Unknown title";
  let imageUrl: string | undefined = undefined;

  const dubbingLanguage = options.dubbingLanguage;
  if (!isDubbingLanguage(dubbingLanguage)) {
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      error: "Regional dubbing language is required for extraction",
    };
  }

  try {
    const igdbClient = useIgdbClient(cache);
    const [game, characters] = await Promise.all([
      igdbClient.getGame(igdbId),
      igdbClient.getGameCharacters(igdbId),
    ]);

    if (!game) {
      throw new Error(`IGDB game ${igdbId} not found`);
    }

    gameTitle = game.name;
    if (game.cover) {
      imageUrl = buildIgdbImageUrl(game.cover.image_id, "cover_big") || undefined;
    }

    const characterMap = new Map(
      characters.map((character) => [character.name?.toLowerCase(), character]),
    );

    const wikipediaCache = useWikipediaCache(cache);
    // ponytail: check and extract run on different cron ticks — drop indexes
    // that no longer match (stale payloads)
    const pageSections = await wikipediaCache.getPageSections(pageId, wikipediaLanguage);
    const validIndexes = await filterValidSectionIndexes(
      pageSections.parse?.tocdata?.sections || pageSections.parse?.sections || [],
      sectionIndexes,
    );
    if (validIndexes.length === 0) {
      return {
        ok: false,
        changes: 0,
        creditsAdded: 0,
        title: gameTitle,
        imageUrl,
        error: `Stale queue element: section(s) [${sectionIndexes.join(", ")}] no longer match candidate headings on the "${wikipediaLanguage}" Wikipedia page.`,
      };
    }
    let totalNewVoiceActors = 0;
    let totalNewCredits = 0;

    let llmModel: string | undefined;
    let llmQuota: string | undefined;
    for (const sectionIndex of validIndexes) {
      const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
        pageId,
        String(sectionIndex),
        wikipediaLanguage,
      );
      const wikitext = wikitextJSON.parse?.wikitext;
      if (!wikitext) continue;

      const llmResult = await llmGenerateObject(wikitext, dubbingExtractionSchema, {
        systemInstruction: `${dubbingExtractionSystemInstruction}

The requested target dubbing region is ${dubbingLanguage} (${displayDubbingLanguage(dubbingLanguage, "en")}). Extract only credits for this target. Exclude other regional versions and original-language casting. The Wikipedia edition is a source identifier, never evidence of the dubbing market.`,
        temperature: 0,
      });
      llmModel = llmResult.model;
      llmQuota = llmResult.quota ?? llmQuota;

      for (const entry of llmResult.data?.items ?? []) {
        let { actor, voiceActorFirstname, voiceActorName } = entry;

        if (!actor || !voiceActorFirstname || !voiceActorName) {
          continue;
        }

        if (
          !isExploitableVoiceActorName(voiceActorFirstname) ||
          !isExploitableVoiceActorName(voiceActorName)
        ) {
          continue;
        }

        const igdbChar = characterMap.get(actor.toLowerCase());
        const actorId = igdbChar
          ? igdbChar.id
          : Math.abs(
              actor
                .split("")
                .reduce((hash: number, c: string) => (hash * 31 + c.charCodeAt(0)) | 0, 0),
            ) + 8_000_000_000;

        const result = await insertVoiceActorAndWork(
          voiceActorFirstname,
          voiceActorName,
          igdbId,
          actorId,
          "video_game",
          dubbingLanguage,
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
          ? `No dubbing entries matched (LLM: ${llmModel || "unknown"}). Check if Wikipedia has dubbing tables for ${wikipediaLanguage}.`
          : undefined,
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    console.error(`[media-preparation:pipe3] extractGame failed:`, errorMsg, error);
    return {
      ok: false,
      changes: 0,
      creditsAdded: 0,
      title: gameTitle,
      imageUrl,
      error: errorMsg,
      retryable: isRetryableMediaRequestError(error),
    };
  }
}

// ---------------------------------------------------------------------------
// High-Level Full Preparation Wrappers (for manual / instant UI execution)
// ---------------------------------------------------------------------------

export async function prepareMedia(options: {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  seasonNumber: number | null;
  episodeNumber: number | null;
  wikipediaLanguage: string;
  dubbingLanguage: DubbingLanguage;
}): Promise<PrepareMediaResult> {
  const { tmdbId, type, wikipediaLanguage, dubbingLanguage } = options;
  if (!wikipediaLanguage) {
    throw new Error("Direct prepareMedia requires a Wikipedia source language.");
  }

  if (!isDubbingLanguage(dubbingLanguage)) {
    throw new Error("Regional dubbing language is required for extraction");
  }

  const check = await checkMediaDubbingSections({
    tmdbId,
    type,
    wikipediaLanguage,
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
    wikipediaLanguage,
    dubbingLanguage,
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
    languages: [wikipediaLanguage],
    error: extract.error,
  };
}

export async function prepareGame(options: {
  igdbId: number;
  wikipediaLanguage: string;
  dubbingLanguage: DubbingLanguage;
}): Promise<PrepareGameResult> {
  const { igdbId, wikipediaLanguage, dubbingLanguage } = options;
  if (!wikipediaLanguage) {
    throw new Error("Direct prepareGame requires a Wikipedia source language.");
  }

  if (!isDubbingLanguage(dubbingLanguage)) {
    throw new Error("Regional dubbing language is required for extraction");
  }

  const check = await checkGameDubbingSections({
    igdbId,
    wikipediaLanguage,
  });
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
    wikipediaLanguage,
    dubbingLanguage,
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
    languages: [wikipediaLanguage],
    error: extract.error,
  };
}
