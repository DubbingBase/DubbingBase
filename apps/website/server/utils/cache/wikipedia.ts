import { type CacheTTLPreset, SimpleCache } from "./index";
import { CACHE_KEYS } from "./constants";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

const frenchMaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Acteur_fran%C3%A7ais_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;
const frenchFemaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Actrice_fran%C3%A7aise_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;

const wikipediaPageFindSections = (pageId: number) =>
  `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=tocdata&formatversion=2`;

const parseDubberPageAsHTML = (pageId: number, sectionId: string) =>
  `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=text&formatversion=2&section=${sectionId}`;

const parseDubberPageAsWikitext = (pageId: number, sectionId: string) =>
  `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

const searchEntities = (search: string) =>
  `https://wikidata.org/w/api.php?action=wbsearchentities&format=json&search=${encodeURIComponent(search)}&language=fr`;

const getEntity = (entityId: string, language = "fr") =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=${entityId}&sitefilter=${language}wiki`;

const getWikipediaPageSectionAsWikitext = (pageId: number, sectionId: string) =>
  `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

const getWikipediaPage = (title: string, language = "fr") =>
  `https://${language}.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=${encodeURIComponent(title)}`;

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

  async getPageSections(pageId: number): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, "sections");
    const url = wikipediaPageFindSections(pageId);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageContentAsHTML(pageId: number, sectionId: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `html-${sectionId}`);
    const url = parseDubberPageAsHTML(pageId, sectionId);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageContentAsWikitext(
    pageId: number,
    sectionId: string,
  ): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `wikitext-${sectionId}`);
    const url = parseDubberPageAsWikitext(pageId, sectionId);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async getPageSectionAsWikitext(
    pageId: number,
    sectionId: string,
  ): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(
      pageId,
      `section-wikitext-${sectionId}`,
    );
    const url = getWikipediaPageSectionAsWikitext(pageId, sectionId);
    return await this.fetchWithCache(url, cacheKey, "LONG");
  }

  async searchWikidataEntities(search: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(search);
    const url = searchEntities(search);
    return await this.fetchWithCache(url, cacheKey, "MEDIUM");
  }

  async getWikidataEntity(entityId: string, language = "fr"): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_ENTITY(entityId, language);
    const url = getEntity(entityId, language);
    return await this.fetchWithCache(url, cacheKey, "EXTENDED");
  }

  async getWikipediaPageInfo(title: string, language = "fr"): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(title, language);
    const url = getWikipediaPage(title, language);
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
