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
 * Popularity ranking for dubbing and voice-acting Wikipedia editions.
 * Primary dubbing markets appear first to ensure high-priority processing in the queue.
 */
export const LANGUAGE_POPULARITY_RANK: readonly string[] = [
  "fr", // French (DubbingBase primary)
  "ja", // Japanese (Seiyuu / Anime / Games)
  "en", // English (Original cast & foreign dubs)
  "es", // Spanish (Latin America & Spain)
  "de", // German (Synchronisation)
  "it", // Italian (Doppiaggio)
  "pt", // Portuguese (Brazil & Portugal)
  "pt-br",
  "ru", // Russian (Дубляж)
  "pl", // Polish (Dubbing / Obsada)
  "nl", // Dutch (Stemmen)
  "sv", // Swedish (Svenska röster)
  "da", // Danish (Danske stemmer)
  "no", // Norwegian (Norske stemmer)
  "fi", // Finnish (Suomenkielinen)
  "cs", // Czech (Dabing)
  "hu", // Hungarian (Szinkron)
  "tr", // Turkish (Seslendirme)
  "zh", // Chinese (配音)
  "zh-cn",
  "zh-tw",
  "zh-hk",
  "zh-yue",
  "ko", // Korean (더빙 / 성우)
  "uk", // Ukrainian (Дублювання)
  "el", // Greek (Μεταγλώττιση)
  "he", // Hebrew (דיבוב)
  "ar", // Arabic (دبلجة)
  "th", // Thai (พากย์)
  "vi", // Vietnamese (Lồng tiếng)
  "id", // Indonesian (Alih suara)
  "hi", // Hindi (डबिंग)
  "ro", // Romanian (Dublaj)
  "bg", // Bulgarian (Дублаж)
  "sk", // Slovak (Dabing)
  "hr", // Croatian (Sinkronizacija)
  "sr", // Serbian (Синхронизација)
  "sl", // Slovenian (Sinhronizacija)
  "ca", // Catalan (Doblatge)
  "eu", // Basque (Bikoizketa)
  "gl", // Galician (Dobraxe)
] as const;

/**
 * Sort language codes by popularity/dubbing prominence.
 * Languages in LANGUAGE_POPULARITY_RANK appear first in that exact order.
 * Any remaining languages appear after, sorted alphabetically.
 */
export function sortLanguagesByPopularity(languages: string[]): string[] {
  const rankMap = new Map<string, number>(
    LANGUAGE_POPULARITY_RANK.map((lang, index) => [lang, index]),
  );

  return [...languages].sort((a, b) => {
    const rankA = rankMap.get(a);
    const rankB = rankMap.get(b);

    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;

    return a.localeCompare(b);
  });
}

/**
 * Extract available Wikipedia languages from a Wikidata entity's sitelinks.
 * Returns URL-safe language codes (e.g. "zh-yue") ranked by popularity/dubbing prominence.
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
  return sortLanguagesByPopularity(available);
}

/** Wikidata sitelink key for a URL-safe language code ("pt-br" → "pt_brwiki"). */
export const sitelinkKey = (lang: string) => `${lang.replace(/-/g, "_")}wiki`;

/**
 * Regex matching dubbing, voice acting, and cast sections across all major Wikipedia language editions.
 * ReDoS-safe with strict non-nested patterns.
 */
export const DUBBING_SECTION_REGEX =
  /(?:^|[\s_\-–—/])(?:distribution|doublages?|voix|casting|cast|characters?\s*and\s*cast|version\s*fran[cç]aise|com[eé]diens?\s*de\s*doublage|voice[- ]?(?:cast|over|acting|actor[s]?)?|dubbing|starring|besetzung|synchron(?:isation|sprecher|besetzung|fassung)?|stimmen|reparto(?:[\s_\-–—/]+(?:de\s*)?(?:doblaje|voces))?|doblaj[oe]s?|voces(?:[\s_\-–—/]+en[\s_\-–—/]+espa[ñn]ol)?|actores?(?:[\s_\-–—/]+de[\s_\-–—/]+voz)?|dobragem|dublagem|doppiaggio|doppiatori|voci|nasynchronisatie|r[oö]ster|stemmer|g[lł]os(?:y|i)?|obsada|zn[eě]n[ií]|dabing|szinkron(?:hangok)?|дублир(?:ование|овали)?|дубляж|озвуч(?:ивание|ка)?|закадров(?:ый)?|дублюванн(?:я)?|актор[иы]\s+озвуч|dublaj|seslendirme|μεταγλ[ωώ]ττιση|דיבוב|دبلجة|الدبلجة|alih\s*suara|l[oồ]ng\s*ti[eế]ng|พากย์|डबिंग|더빙|성우|配音(?:員|演員|名單|陣容)?|聲優|声優|吹き替え|日本語吹替(?:版)?|キャスト|配役|登場人物)(?:[\s_\-–—/:]|$)/i;

/**
 * Clean wikitext heading markup (HTML, refs, wikilinks, templates, formatting).
 */
export function cleanHeadingText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<!--[\s\S]*?-->/g, "") // HTML comments
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "") // Full <ref>...</ref>
    .replace(/<ref\b[^>]*\/>/gi, "") // Self-closing <ref />
    .replace(/<[^>]+>/g, "") // Any remaining HTML tags
    .replace(/\{\{[^{}]*\}\}/g, "") // Simple templates {{...}}
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[Target|Text]] or [[Text]]
    .replace(/''+/g, "") // Bold/Italics formatting
    .replace(/&nbsp;/gi, " ") // Non-breaking spaces
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/^[:\s=]+|[:\s=]+$/g, "") // Trim edge colons, equals, whitespace
    .trim();
}

/**
 * Test whether a section heading corresponds to dubbing or voice cast information.
 */
export function isDubbingSectionHeading(heading: string): boolean {
  const cleaned = cleanHeadingText(heading);
  if (!cleaned) return false;
  return DUBBING_SECTION_REGEX.test(cleaned);
}

/**
 * Pick the sections of a page that contain dubbing / voice-actor credits,
 * in ANY language, using high-speed multilingual regex parsing.
 */
export async function selectDubbingSections(
  sections: Array<{ index: number | string; line: string }>,
): Promise<string[]> {
  if (!sections || sections.length === 0) return [];

  const matchedIndexes: string[] = [];
  for (const s of sections) {
    if (s && s.line && isDubbingSectionHeading(s.line)) {
      matchedIndexes.push(String(s.index));
    }
  }

  return matchedIndexes;
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
