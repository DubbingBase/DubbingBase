import { SimpleCache, createCacheNamespace } from "./index";
import { buildCacheKey } from "./constants";
import { createMediaResponseError, fetchMediaRequest } from "../retryable-request";

const WIKIPEDIA_USER_AGENT = "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

const wikipediaSitelinksNamespace = createCacheNamespace<WikidataSitelinksResponse>();

type JsonObject = Record<string, unknown>;

interface WikidataSitelinksResponse {
  entities: Record<string, { sitelinks?: Record<string, { title: string }> }>;
}

interface WikidataSearchResponse {
  search: Array<{ id: string }>;
}

interface WikipediaPageInfoResponse {
  query?: {
    pages?: Record<string, { pageid?: number; pageprops?: { page_image_free?: string } }>;
  };
}

interface WikipediaSection {
  index: number;
  line: string;
}

interface WikipediaSectionsResponse {
  parse?: {
    tocdata?: { sections?: WikipediaSection[] };
    sections?: WikipediaSection[];
  };
}

interface WikipediaWikitextResponse {
  parse?: { wikitext?: string };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWikidataSitelinks(value: unknown): WikidataSitelinksResponse {
  const root = isJsonObject(value) ? value : {};
  const rawEntities = isJsonObject(root.entities) ? root.entities : {};
  const entities: WikidataSitelinksResponse["entities"] = {};

  for (const [entityId, rawEntity] of Object.entries(rawEntities)) {
    if (!isJsonObject(rawEntity) || !isJsonObject(rawEntity.sitelinks)) continue;
    const sitelinks: NonNullable<WikidataSitelinksResponse["entities"][string]["sitelinks"]> = {};
    for (const [language, rawSitelink] of Object.entries(rawEntity.sitelinks)) {
      if (isJsonObject(rawSitelink) && typeof rawSitelink.title === "string") {
        sitelinks[language] = { title: rawSitelink.title };
      }
    }
    entities[entityId] = { sitelinks };
  }

  return { entities };
}

function parseWikidataSearch(value: unknown): WikidataSearchResponse {
  const root = isJsonObject(value) ? value : {};
  const search = Array.isArray(root.search)
    ? root.search.flatMap((item) =>
        isJsonObject(item) && typeof item.id === "string" ? [{ id: item.id }] : [],
      )
    : [];
  return { search };
}

function parseWikipediaPageInfo(value: unknown): WikipediaPageInfoResponse {
  const root = isJsonObject(value) ? value : {};
  if (!isJsonObject(root.query) || !isJsonObject(root.query.pages)) return {};
  const pages: NonNullable<WikipediaPageInfoResponse["query"]>["pages"] = {};

  for (const [pageId, rawPage] of Object.entries(root.query.pages)) {
    if (!isJsonObject(rawPage)) continue;
    const page: NonNullable<NonNullable<WikipediaPageInfoResponse["query"]>["pages"]>[string] = {};
    if (typeof rawPage.pageid === "number") page.pageid = rawPage.pageid;
    if (isJsonObject(rawPage.pageprops) && typeof rawPage.pageprops.page_image_free === "string") {
      page.pageprops = { page_image_free: rawPage.pageprops.page_image_free };
    }
    pages[pageId] = page;
  }

  return { query: { pages } };
}

function parseWikipediaSections(value: unknown): WikipediaSectionsResponse {
  const root = isJsonObject(value) ? value : {};
  if (!isJsonObject(root.parse)) return {};
  const parse = root.parse;
  const parseSections = (value: unknown): WikipediaSection[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((section) => {
      if (!isJsonObject(section) || typeof section.line !== "string") return [];
      const index = typeof section.index === "number" ? section.index : Number(section.index);
      return Number.isInteger(index) ? [{ index, line: section.line }] : [];
    });
  };
  const tocdata = isJsonObject(parse.tocdata) ? parse.tocdata : undefined;
  const sections = parseSections(parse.sections);
  return {
    parse: {
      ...(tocdata ? { tocdata: { sections: parseSections(tocdata.sections) } } : {}),
      ...(sections ? { sections } : {}),
    },
  };
}

function parseWikipediaWikitext(value: unknown): WikipediaWikitextResponse {
  const root = isJsonObject(value) ? value : {};
  if (!isJsonObject(root.parse) || typeof root.parse.wikitext !== "string") return {};
  return { parse: { wikitext: root.parse.wikitext } };
}

const frenchMaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Acteur_fran%C3%A7ais_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;
const frenchFemaleDubber = (cmContinue = "") =>
  `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Actrice_fran%C3%A7aise_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;

const wikipediaPageFindSections = (pageId: number, lang: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=tocdata&formatversion=2`;

const parseDubberPageAsHTML = (pageId: number, sectionId: string, lang: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=text&formatversion=2&section=${sectionId}`;

const parseDubberPageAsWikitext = (pageId: number, sectionId: string, lang: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

const searchEntities = (search: string, lang: string) =>
  `https://wikidata.org/w/api.php?action=wbsearchentities&format=json&search=${encodeURIComponent(search)}&language=${lang}`;

const getAllSitelinks = (entityId: string) =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=${entityId}`;

const getWikipediaPageSectionAsWikitext = (pageId: number, sectionId: string, lang: string) =>
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
    const lang = key.match(/^([a-z]{2,3}(?:_[a-z0-9]{2,})*)wiki$/)?.[1];
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
  /(?:^|[\s_\-–—/])(?:distribution|elenco|vozes|vers[aã]o\s+(?:brasileira|portuguesa)|doublages?|voix|casting|cast|characters?\s*and\s*cast|version\s*(?:fran[cç]aise|qu[eé]b[eé]coise)|com[eé]diens?\s*de\s*doublage|voice[- ]?(?:cast|over|acting|actor[s]?)?|dubbing|starring|besetzung|synchron(?:isation|sprecher|besetzung|fassung)?|stimmen|reparto[\s_\-–—/]+(?:de[\s_\-–—/]+)?(?:doblaje|voces)|doblaj[oe]s?|voces(?:[\s_\-–—/]+en[\s_\-–—/]+espa[ñn]ol)?|actores?[\s_\-–—/]+de[\s_\-–—/]+voz|dobragem|dublagem|doppiaggio|doppiatori|voci|nasynchronisatie|r[oö]ster|stemmer|g[lł]os(?:y|i)?|obsada|zn[eě]n[ií]|dabing|szinkron(?:hangok)?|дублир(?:ование|овали)?|дубляж|озвуч(?:ивание|ка)?|закадров(?:ый)?|дублюванн(?:я)?|актор[иы]\s+озвуч|dublaj|seslendirme|μεταγλ[ωώ]ττιση|דיבוב|دبلجة|الدبلجة|alih\s*suara|l[oồ]ng\s*ti[eế]ng|พากย์|डबिंग|더빙|성우|配音(?:員|演員|名單|陣容)?|聲優|声優|吹き替え|日本語吹替(?:版)?|キャスト|配役|登場人物)(?:[\s_\-–—/:]|$)/i;

const GENERIC_CAST_SECTION_REGEX =
  /(?:^|[\s_\-–—/])(?:distribution|elenco|casting|cast|characters?\s*and\s*cast|starring|besetzung|reparto|obsada|キャスト|配役|登場人物)(?:[\s_\-–—/:]|$)/i;

const EXPLICIT_DUBBING_CUE_REGEX =
  /(?:doublage|voix|version\s*(?:fran[cç]aise|qu[eé]b[eé]coise)|com[eé]diens?\s*de\s*doublage|voice|dubbing|synchron|stimmen|doblaj[oe]s?|voces|actores?\s*de\s*voz|dobragem|dublagem|doppiaggio|doppiatori|voci|nasynchronisatie|r[oö]ster|stemmer|g[lł]os|zn[eě]n[ií]|dabing|szinkron|дублир|дубляж|озвуч|закадров|дублюван|актор[иы]\s+озвуч|dublaj|seslendirme|μεταγλ|דיבוב|دبلجة|alih\s*suara|l[oồ]ng\s*ti[eế]ng|พากย์|डबिंग|더빙|성우|配音|聲優|声優|吹き替え|日本語吹替)(?:[\s_\-–—/:]|$)/i;

export type DubbingSectionCandidate = {
  index: number;
  heading: string;
  headingKind: "explicit_dubbing" | "generic_cast";
};

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
 * Test whether a heading is a candidate for later inspection for dubbing evidence.
 */
export function isDubbingSectionHeading(heading: string): boolean {
  const cleaned = cleanHeadingText(heading);
  if (!cleaned) return false;
  return DUBBING_SECTION_REGEX.test(cleaned) || GENERIC_CAST_SECTION_REGEX.test(cleaned);
}

/**
 * Select headings worth inspecting for dubbing evidence. A heading is only a
 * candidate: neither explicit wording nor a generic cast heading proves that
 * the section contains dubbing credits.
 */
export async function selectDubbingCandidateSections(
  sections: Array<{ index: number | string; line: string }>,
): Promise<DubbingSectionCandidate[]> {
  if (!sections || sections.length === 0) return [];

  const candidates: DubbingSectionCandidate[] = [];
  for (const s of sections) {
    if (!s || !s.line) continue;
    const heading = cleanHeadingText(s.line);
    if (
      !heading ||
      (!DUBBING_SECTION_REGEX.test(heading) && !GENERIC_CAST_SECTION_REGEX.test(heading))
    ) {
      continue;
    }
    const index = Number(s.index);
    if (!Number.isInteger(index)) continue;
    candidates.push({
      index,
      heading,
      headingKind:
        EXPLICIT_DUBBING_CUE_REGEX.test(heading) || !GENERIC_CAST_SECTION_REGEX.test(heading)
          ? "explicit_dubbing"
          : "generic_cast",
    });
  }

  return candidates;
}

/** @deprecated Use selectDubbingCandidateSections; candidates do not prove dubbing exists. */
export async function selectDubbingSections(
  sections: Array<{ index: number | string; line: string }>,
): Promise<string[]> {
  if (!sections || sections.length === 0) return [];
  return sections
    .filter(
      (section) => section?.line && DUBBING_SECTION_REGEX.test(cleanHeadingText(section.line)),
    )
    .map(({ index }) => String(index));
}

/**
 * Drop requested section indexes that no longer match candidate headings.
 * Queue check and extract run on different cron ticks, so a payload can go
 * stale after the page or candidate detector changes.
 */
export async function filterValidSectionIndexes(
  sections: Array<{ index: number | string; line: string }>,
  requested: number[],
): Promise<number[]> {
  const valid = new Set((await selectDubbingCandidateSections(sections)).map(({ index }) => index));
  return requested.filter((index) => valid.has(index));
}

export class WikipediaCache {
  constructor(private cache: SimpleCache) {}

  async getMaleVoiceActors(cmContinue = ""): Promise<unknown> {
    const url = frenchMaleDubber(cmContinue);
    return this.fetch(url);
  }

  async getFemaleVoiceActors(cmContinue = ""): Promise<unknown> {
    const url = frenchFemaleDubber(cmContinue);
    return this.fetch(url);
  }

  async getPageSections(pageId: number, lang: string): Promise<WikipediaSectionsResponse> {
    const url = wikipediaPageFindSections(pageId, lang);
    return parseWikipediaSections(await this.fetch(url));
  }

  async getPageContentAsHTML(pageId: number, sectionId: string, lang: string): Promise<unknown> {
    const url = parseDubberPageAsHTML(pageId, sectionId, lang);
    return this.fetch(url);
  }

  async getPageContentAsWikitext(
    pageId: number,
    sectionId: string,
    lang: string,
  ): Promise<unknown> {
    const url = parseDubberPageAsWikitext(pageId, sectionId, lang);
    return this.fetch(url);
  }

  async getPageSectionAsWikitext(
    pageId: number,
    sectionId: string,
    lang: string,
  ): Promise<WikipediaWikitextResponse> {
    const url = getWikipediaPageSectionAsWikitext(pageId, sectionId, lang);
    return parseWikipediaWikitext(await this.fetch(url));
  }

  async searchWikidataEntities(search: string, lang: string): Promise<WikidataSearchResponse> {
    // Search is intentionally uncached; queue lookups are low-reuse.
    const url = searchEntities(search, lang);
    return parseWikidataSearch(await this.fetch(url));
  }

  async getAllSitelinksEntity(entityId: string): Promise<WikidataSitelinksResponse> {
    // Wikidata sitelinks are stable cross-reference metadata.
    const cacheKey = buildCacheKey({
      provider: "wikipedia",
      resource: "entity",
      id: entityId,
      params: { suffix: "all" },
    });
    const url = getAllSitelinks(entityId);
    return parseWikidataSitelinks(
      await this.cache.getOrFetch(wikipediaSitelinksNamespace, cacheKey, () => this.fetch(url), {
        cachePolicy: "persistent",
        ttl: "STABLE",
      }),
    );
  }

  async getWikipediaPageInfo(title: string, language: string): Promise<WikipediaPageInfoResponse> {
    const url = getWikipediaPage(title, language);
    return parseWikipediaPageInfo(await this.fetch(url));
  }

  async getImageFromFilename(filename: string, lang: string): Promise<unknown> {
    const url = getImageFromFilename(filename, lang);
    return this.fetch(url);
  }

  private async fetch(url: string): Promise<unknown> {
    const response = await fetchMediaRequest(url, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw createMediaResponseError("Wikipedia", response);
    }
    return response.json();
  }
}
