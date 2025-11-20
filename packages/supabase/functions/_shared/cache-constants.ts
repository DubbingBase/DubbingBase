/**
 * Simplified cache key utilities using consistent api:type:id patterns
 */

// Common API prefixes for consistent key generation
export const API_PREFIXES = {
  TMDB: 'tmdb',
  TVDB: 'tvdb',
  WIKIPEDIA: 'wikipedia',
  APP: 'app',
} as const;

// Common content types for consistent key generation
export const CONTENT_TYPES = {
  MOVIE: 'movie',
  TV: 'tv',
  EPISODE: 'episode',
  SERIES: 'series',
  PERSON: 'person',
  CHARACTER: 'character',
  VOICE_ACTOR: 'voice-actor',
  ENTITY: 'entity',
  SEARCH: 'search',
  TRENDING: 'trending',
  USER: 'user',
} as const;

/**
 * Simple cache key builder using api:type:id pattern
 */
export class SimpleKeyBuilder {
  /**
   * Generate a cache key using the simple api:type:id pattern
   * @param api - API source (tmdb, tvdb, wikipedia, app)
   * @param type - Content type (movie, person, etc.)
   * @param id - Content identifier
   * @param suffix - Optional suffix for data type (details, credits, etc.)
   */
  static key(api: string, type: string, id: string | number, suffix?: string): string {
    const baseKey = `${api}:${type}:${id}`;
    return suffix ? `${baseKey}:${suffix}` : baseKey;
  }

  /**
   * Generate TMDB-specific keys
   */
  static tmdb(type: string, id: number, suffix?: string): string {
    return this.key(API_PREFIXES.TMDB, type, id, suffix);
  }

  /**
   * Generate TVDB-specific keys
   */
  static tvdb(type: string, id: number, suffix?: string): string {
    return this.key(API_PREFIXES.TVDB, type, id, suffix);
  }

  /**
   * Generate Wikipedia-specific keys
   */
  static wikipedia(type: string, id: string, suffix?: string): string {
    return this.key(API_PREFIXES.WIKIPEDIA, type, id, suffix);
  }

  /**
   * Generate application-specific keys
   */
  static app(type: string, id: string, suffix?: string): string {
    return this.key(API_PREFIXES.APP, type, id, suffix);
  }
}

/**
 * Common cache key patterns for quick reference
 */
export const CACHE_KEYS = {
  // TMDB patterns
  TMDB_MOVIE: (id: number, suffix?: string) => SimpleKeyBuilder.tmdb(CONTENT_TYPES.MOVIE, id, suffix),
  TMDB_TV: (id: number, suffix?: string) => SimpleKeyBuilder.tmdb(CONTENT_TYPES.TV, id, suffix),
  TMDB_EPISODE: (id: number, suffix?: string) => SimpleKeyBuilder.tmdb(CONTENT_TYPES.EPISODE, id, suffix),

  // TVDB patterns
  TVDB_SERIES: (id: number, suffix?: string) => SimpleKeyBuilder.tvdb(CONTENT_TYPES.SERIES, id, suffix),
  TVDB_EPISODE: (id: number, suffix?: string) => SimpleKeyBuilder.tvdb(CONTENT_TYPES.EPISODE, id, suffix),
  TVDB_PERSON: (id: number, suffix?: string) => SimpleKeyBuilder.tvdb(CONTENT_TYPES.PERSON, id, suffix),
  TVDB_CHARACTER: (id: number, suffix?: string) => SimpleKeyBuilder.tvdb(CONTENT_TYPES.CHARACTER, id, suffix),

  // Wikipedia patterns
  WIKIPEDIA_VOICE_ACTOR: (id: string, suffix?: string) => SimpleKeyBuilder.wikipedia(CONTENT_TYPES.VOICE_ACTOR, id, suffix),
  WIKIPEDIA_ENTITY: (id: string, suffix?: string) => SimpleKeyBuilder.wikipedia(CONTENT_TYPES.ENTITY, id, suffix),
  WIKIPEDIA_PAGE: (id: number, suffix?: string) => SimpleKeyBuilder.wikipedia('page', id.toString(), suffix),
  WIKIPEDIA_CATEGORY: (category: string, suffix?: string) => SimpleKeyBuilder.wikipedia('category', category, suffix),
  WIKIPEDIA_SEARCH: (query: string, suffix?: string) => SimpleKeyBuilder.wikipedia(CONTENT_TYPES.SEARCH, query.toLowerCase().replace(/[^a-z0-9]/g, '_'), suffix),

  // Application patterns
  APP_TRENDING_MOVIES: () => SimpleKeyBuilder.app(CONTENT_TYPES.TRENDING, 'movies'),
  APP_TRENDING_SHOWS: () => SimpleKeyBuilder.app(CONTENT_TYPES.TRENDING, 'shows'),
  APP_SEARCH: (query: string) => SimpleKeyBuilder.app(CONTENT_TYPES.SEARCH, query.toLowerCase().replace(/[^a-z0-9]/g, '_')),
  APP_USER_PROFILE: (userId: string) => SimpleKeyBuilder.app(CONTENT_TYPES.USER, userId, 'profile'),
} as const;

/**
 * Simple cache key validation
 */
export class SimpleKeyValidator {
  /**
   * Validate that a cache key follows expected patterns
   */
  static isValidKey(key: string): boolean {
    return /^[a-zA-Z0-9:_-]+$/.test(key) && key.length > 0 && key.length <= 200;
  }

  /**
   * Sanitize a cache key to ensure it's safe for Redis
   */
  static sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9:_-]/g, '_').substring(0, 200);
  }
}