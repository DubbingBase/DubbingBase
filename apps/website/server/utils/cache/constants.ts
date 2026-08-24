// Common API prefixes for consistent key generation
export const API_PREFIXES = {
  TMDB: "tmdb",
  TVDB: "tvdb",
  WIKIPEDIA: "wikipedia",
  APP: "app",
} as const;

// Common content types for consistent key generation
export const CONTENT_TYPES = {
  MOVIE: "movie",
  TV: "tv",
  EPISODE: "episode",
  SERIES: "series",
  PERSON: "person",
  CHARACTER: "character",
  VOICE_ACTOR: "voice-actor",
  ENTITY: "entity",
  SEARCH: "search",
  TRENDING: "trending",
  USER: "user",
} as const;

// Simple cache key builder using api:type:id pattern
export class SimpleKeyBuilder {
  static key(
    api: string,
    type: string,
    id: string | number,
    suffix?: string,
  ): string {
    const baseKey = `${api}:${type}:${id}`;
    return suffix ? `${baseKey}:${suffix}` : baseKey;
  }

  static tmdb(type: string, id: string | number, suffix?: string): string {
    return this.key(API_PREFIXES.TMDB, type, id, suffix);
  }

  static tvdb(type: string, id: string | number, suffix?: string): string {
    return this.key(API_PREFIXES.TVDB, type, id, suffix);
  }

  static wikipedia(type: string, id: string, suffix?: string): string {
    return this.key(API_PREFIXES.WIKIPEDIA, type, id, suffix);
  }

  static app(type: string, id: string, suffix?: string): string {
    return this.key(API_PREFIXES.APP, type, id, suffix);
  }
}

// Common cache key patterns
export const CACHE_KEYS = {
  TMDB_MOVIE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.MOVIE, id, suffix),
  TMDB_TV: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.TV, id, suffix),
  TMDB_EPISODE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.EPISODE, id, suffix),
  TMDB_PERSON: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.PERSON, id, suffix),
  TMDB_TRENDING_MOVIES: () =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.TRENDING, "movies:v2"),
  TMDB_TRENDING_SHOWS: () =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.TRENDING, "shows:v2"),

  TVDB_AUTH_TOKEN: () => "tvdb:auth_token",
  TVDB_SERIES: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.SERIES, id, suffix),
  TVDB_MOVIE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.MOVIE, id, suffix),
  TVDB_EPISODE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.EPISODE, id, suffix),
  TVDB_PERSON: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.PERSON, id, suffix),
  TVDB_CHARACTER: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.CHARACTER, id, suffix),
  TVDB_SEARCH: (query: string, suffix?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.SEARCH, query, suffix),

  WIKIPEDIA_VOICE_ACTOR: (id: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia(CONTENT_TYPES.VOICE_ACTOR, id, suffix),
  WIKIPEDIA_ENTITY: (id: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia(CONTENT_TYPES.ENTITY, id, suffix),
  WIKIPEDIA_PAGE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.wikipedia("page", id.toString(), suffix),
  WIKIPEDIA_CATEGORY: (category: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia("category", category, suffix),
  WIKIPEDIA_SEARCH: (query: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia(
      CONTENT_TYPES.SEARCH,
      query.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      suffix,
    ),

  APP_TRENDING_MOVIES: () =>
    SimpleKeyBuilder.app(CONTENT_TYPES.TRENDING, "movies"),
  APP_TRENDING_SHOWS: () =>
    SimpleKeyBuilder.app(CONTENT_TYPES.TRENDING, "shows"),
  APP_SEARCH: (query: string) =>
    SimpleKeyBuilder.app(
      CONTENT_TYPES.SEARCH,
      query.toLowerCase().replace(/[^a-z0-9]/g, "_"),
    ),
  APP_USER_PROFILE: (userId: string) =>
    SimpleKeyBuilder.app(CONTENT_TYPES.USER, userId, "profile"),
} as const;

// Cache key validation
export class SimpleKeyValidator {
  static isValidKey(key: string): boolean {
    return /^[a-zA-Z0-9:_-]+$/.test(key) && key.length > 0 && key.length <= 200;
  }

  static sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9:_-]/g, "_").substring(0, 200);
  }
}
