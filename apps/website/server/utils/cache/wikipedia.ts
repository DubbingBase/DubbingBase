import { type CacheTTLPreset, SimpleCache } from "./index";
import { CACHE_KEYS } from "./constants";
import { llmGenerateObject } from "../llm";
import { z } from "zod";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

const frenchMaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Acteur_fran%C3%A7ais_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;
const frenchFemaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Actrice_fran%C3%A7aise_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;

const wikipediaPageFindSections = (pageId: number, lang: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=tocdata&formatversion=2`;

const parseDubberPageAsHTML = (
  pageId: number,
  sectionId: string,
  lang: string,
) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=text&formatversion=2&section=${sectionId}`;

const parseDubberPageAsWikitext = (
  pageId: number,
  sectionId: string,
  lang: string,
) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

const searchEntities = (search: string, lang: string) =>
  `https://wikidata.org/w/api.php?action=wbsearchentities&format=json&search=${encodeURIComponent(search)}&language=${lang}`;

const getAllSitelinks = (entityId: string) =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=${entityId}`;

const getWikipediaPageSectionAsWikitext = (
  pageId: number,
  sectionId: string,
  lang: string,
) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

const getWikipediaPage = (title: string, language: string) =>
  `https://${language}.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=${encodeURIComponent(title)}`;

const getImageFromFilename = (filename: string, lang: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;

/**
 * Extract available Wikipedia languages from a Wikidata entity's sitelinks.
 * Returns URL-safe language codes (e.g. "zh-yue") for ALL editions, sorted
 * alphabetically for deterministic processing order. This is intentionally
 * independent of website UI localization — any Wikipedia edition may hold
 * dubbing data.
 */
export function extractAvailableLanguages(
  sitelinks: Record<string, { title: string }> | undefined,
): string[] {
  if (!sitelinks) return [];

  const available: string[] = [];
  for (const key of Object.keys(sitelinks)) {
    const lang = key.match(/^([a-z]{2,3}(?:_[a-z0-9]{2,})*|simple)wiki$/)?.[1];
    if (lang) {
      available.push(lang.replace(/_/g, "-"));
    }
  }
  return available.sort();
}

/** Wikidata sitelink key for a URL-safe language code ("pt-br" → "pt_brwiki"). */
export const sitelinkKey = (lang: string) =>
  `${lang.replace(/-/g, "_")}wiki`;

/**
 * Pick the sections of a page that contain dubbing / voice-actor credits,
 * in ANY language. Uses one LLM call over the section titles so coverage is
 * not limited to a hardcoded vocabulary.
 */
export async function selectDubbingSections(
  sections: Array<{ index: number | string; line: string }>,
): Promise<string[]> {
  if (sections.length === 0) return [];

  const schema = z.object({
    dubbingSectionIndexes: z.array(z.string()),
  });

  try {
    const list = sections
      .map((s) => `${s.index}: ${s.line}`)
      .join("\n");
    const parsed = await llmGenerateObject(
      `Below is the table of contents of a Wikipedia article. List the indexes of every section that contains dubbing or voice-actor credit information for a production (e.g. voice cast tables, dubbing actor lists, original actor / voice actor columns). Include subsections only when they themselves hold credits. Return [] if none.

${list}`,
      schema,
      {
        systemInstruction:
          "You identify Wikipedia sections containing dubbing/voice-acting credits, regardless of the article's language. Respond only with matching section indexes.",
        temperature: 0,
      },
    );
    const valid = new Set(sections.map((s) => String(s.index)));
    return (parsed.dubbingSectionIndexes || []).filter((i) =>
      valid.has(String(i)),
    );
  } catch (err) {
    console.warn("selectDubbingSections failed:", err);
    return [];
  }
}

export class WikipediaCache {
  constructor(private cache: SimpleCache) {}

  async getMaleVoiceActors(cmContinue = ""): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_CATEGORY(
      "male-voice-actors",
      cmContinue || "initial",
    );
    const url = frenchMaleDubber(cmContinue);
    return await this.fetchWithCache(url, cacheKey, "MEDIUM");
  }

  async getFemaleVoiceActors(cmContinue = ""): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_CATEGORY(
      "female-voice-actors",
      cmContinue || "initial",
    );
    const url = frenchFemaleDubber(cmContinue);
    return await this.fetchWithCache(url, cacheKey, "MEDIUM");
  }

  async getPageSections(pageId: number, lang: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `sections-${lang}`);
    const url = wikipediaPageFindSections(pageId, lang);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageContentAsHTML(
    pageId: number,
    sectionId: string,
    lang: string,
  ): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(
      pageId,
      `html-${sectionId}-${lang}`,
    );
    const url = parseDubberPageAsHTML(pageId, sectionId, lang);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageContentAsWikitext(
    pageId: number,
    sectionId: string,
    lang: string,
  ): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(
      pageId,
      `wikitext-${sectionId}-${lang}`,
    );
    const url = parseDubberPageAsWikitext(pageId, sectionId, lang);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageSectionAsWikitext(
    pageId: number,
    sectionId: string,
    lang: string,
  ): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(
      pageId,
      `section-wikitext-${sectionId}-${lang}`,
    );
    const url = getWikipediaPageSectionAsWikitext(pageId, sectionId, lang);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async searchWikidataEntities(search: string, lang: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(`${search}-${lang}`);
    const url = searchEntities(search, lang);
    return await this.fetchWithCache(url, cacheKey, "MEDIUM");
  }

  async getAllSitelinksEntity(entityId: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_ENTITY(entityId, "all");
    const url = getAllSitelinks(entityId);
    return await this.fetchWithCache(url, cacheKey, "EXTENDED");
  }

  async getWikipediaPageInfo(title: string, language: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(title, language);
    const url = getWikipediaPage(title, language);
    return await this.fetchWithCache(url, cacheKey, "EXTENDED");
  }

  async getImageFromFilename(filename: string, lang: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(0, `image-${filename}-${lang}`);
    const url = getImageFromFilename(filename, lang);
    return await this.fetchWithCache(url, cacheKey, "EXTENDED");
  }

  private async fetchWithCache(
    url: string,
    cacheKey: string,
    ttl: CacheTTLPreset,
  ): Promise<any> {
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      console.log(`[WIKIPEDIA CACHE] Hit for key: ${cacheKey}`);
      return cached;
    }

    console.log(
      `[WIKIPEDIA CACHE] Miss for key: ${cacheKey}, fetching from API`,
    );
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(
          `Wikipedia API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data && Array.isArray(data.search) && data.search.length === 0) {
        console.log(
          `[WIKIPEDIA CACHE] Search query returned empty, not caching: ${cacheKey}`,
        );
      } else {
        await this.cache.set(cacheKey, data, ttl);
      }

      return data;
    } catch (error) {
      console.error(`[WIKIPEDIA CACHE] Error fetching ${url}:`, error);
      throw error;
    }
  }
}
