import { SimpleCache, CacheTTLPreset } from './cache-utils.ts';
import { CACHE_KEYS } from './cache-constants.ts';
import { IRedisClient } from './interfaces.ts';
import {
  frenchMaleDubber,
  frenchFemaleDubber,
  wikipediaPageFindSections,
  parseDubberPageAsHTML,
  parseDubberPageAsWikitext,
  searchEntities,
  getEntity,
  getWikipediaPage,
  getWikipediaPageSectionAsWikitext
} from './extract/constants.ts';

/**
 * Wikipedia API cache utility with appropriate TTLs for different data types
 */
export class WikipediaCache {
  constructor(private cache: SimpleCache) {}

  /**
   * Cache Wikipedia category members (male voice actors)
   * TTL: MEDIUM (6 hours) - category membership changes occasionally
   */
  async getMaleVoiceActors(cmContinue = ""): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_CATEGORY('male-voice-actors', cmContinue || 'initial');
    const url = frenchMaleDubber(cmContinue);

    return await this.fetchWithCache(url, cacheKey, 'MEDIUM');
  }

  /**
   * Cache Wikipedia category members (female voice actors)
   * TTL: MEDIUM (6 hours) - category membership changes occasionally
   */
  async getFemaleVoiceActors(cmContinue = ""): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_CATEGORY('female-voice-actors', cmContinue || 'initial');
    const url = frenchFemaleDubber(cmContinue);

    return await this.fetchWithCache(url, cacheKey, 'MEDIUM');
  }

  /**
   * Cache Wikipedia page sections
   * TTL: LONG (24 hours) - page structure doesn't change frequently
   */
  async getPageSections(pageId: number): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, 'sections');
    const url = wikipediaPageFindSections(pageId);

    return await this.fetchWithCache(url, cacheKey, 'LONG');
  }

  /**
   * Cache Wikipedia page content as HTML
   * TTL: LONG (24 hours) - page content doesn't change frequently
   */
  async getPageContentAsHTML(pageId: number, sectionId: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `html-${sectionId}`);
    const url = parseDubberPageAsHTML(pageId, sectionId);

    return await this.fetchWithCache(url, cacheKey, 'LONG');
  }

  /**
   * Cache Wikipedia page content as Wikitext
   * TTL: LONG (24 hours) - page content doesn't change frequently
   */
  async getPageContentAsWikitext(pageId: number, sectionId: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `wikitext-${sectionId}`);
    const url = parseDubberPageAsWikitext(pageId, sectionId);

    return await this.fetchWithCache(url, cacheKey, 'LONG');
  }

  /**
   * Cache Wikipedia page section as Wikitext (alternative function)
   * TTL: LONG (24 hours) - page content doesn't change frequently
   */
  async getPageSectionAsWikitext(pageId: number, sectionId: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_PAGE(pageId, `section-wikitext-${sectionId}`);
    const url = getWikipediaPageSectionAsWikitext(pageId, sectionId);

    return await this.fetchWithCache(url, cacheKey, 'LONG');
  }

  /**
   * Cache Wikidata entity search results
   * TTL: MEDIUM (6 hours) - search results may change occasionally
   */
  async searchWikidataEntities(search: string): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(search);
    const url = searchEntities(search);

    return await this.fetchWithCache(url, cacheKey, 'MEDIUM');
  }

  /**
   * Cache Wikidata entity information
   * TTL: EXTENDED (7 days) - reference data is very stable
   */
  async getWikidataEntity(entityId: string, language = "fr"): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_ENTITY(entityId, language);
    const url = getEntity(entityId, language);

    return await this.fetchWithCache(url, cacheKey, 'EXTENDED');
  }

  /**
   * Cache Wikipedia page information
   * TTL: EXTENDED (7 days) - page metadata is very stable
   */
  async getWikipediaPageInfo(title: string, language = "fr"): Promise<any> {
    const cacheKey = CACHE_KEYS.WIKIPEDIA_SEARCH(title, language);
    const url = getWikipediaPage(title, language);

    return await this.fetchWithCache(url, cacheKey, 'EXTENDED');
  }

  /**
   * Generic fetch with cache implementation
   */
  private async fetchWithCache(url: string, cacheKey: string, ttl: CacheTTLPreset): Promise<any> {
    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      console.log(`[WIKIPEDIA CACHE] Hit for key: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from API
    console.log(`[WIKIPEDIA CACHE] Miss for key: ${cacheKey}, fetching from API`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the result
      await this.cache.set(cacheKey, data, ttl);

      return data;
    } catch (error) {
      console.error(`[WIKIPEDIA CACHE] Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Clear all Wikipedia-related cache entries
   */
  async clearWikipediaCache(): Promise<void> {
    console.log('[WIKIPEDIA CACHE] Clearing all Wikipedia cache entries');
    // Note: In a production environment, you might want to implement
    // a more sophisticated cache clearing mechanism
    // For now, we'll rely on TTL expiration
  }

  /**
   * Get cache statistics for Wikipedia APIs
   */
  async getWikipediaCacheStats(): Promise<{
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  }> {
    // Note: This is a simplified implementation
    // In a production environment, you might want to track these metrics
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0
    };
  }
}