// Cache key schema is versioned so stale or ambiguous keys expire naturally.
export const CACHE_SCHEMA_VERSION = "3";

export const API_PREFIXES = {
  TMDB: "tmdb",
  TVDB: "tvdb",
  IGDB: "igdb",
  WIKIPEDIA: "wikipedia",
  OPENLIBRARY: "openlibrary",
  PODCAST: "podcast",
} as const;

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

export interface CacheKeyInput {
  provider: string;
  resource: string;
  id?: string | number;
  query?: string;
  language?: string;
  params?: Readonly<Record<string, string | number | boolean | null | undefined>>;
}

/** A deterministic 64-bit FNV-1a hash over UTF-8 bytes; works in Node and Workers. */
export function hashCacheValue(value: string): string {
  let hash = BigInt("0xcbf29ce484222325");
  for (const byte of new TextEncoder().encode(value)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * BigInt("0x100000001b3"));
  }
  return hash.toString(36);
}

function segment(value: string): string {
  return `${hashCacheValue(value)}-${value.length.toString(36)}`;
}

function stableParams(params: CacheKeyInput["params"]): string | undefined {
  if (!params) return undefined;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

/** Shared key strategy for all external providers and result-changing inputs. */
export function buildCacheKey(input: CacheKeyInput): string {
  const identity = input.query !== undefined ? `q-${input.query}` : `id-${input.id ?? ""}`;
  const params = stableParams(input.params);
  const components = [
    "external",
    `v${CACHE_SCHEMA_VERSION}`,
    input.provider.toLowerCase(),
    input.resource.toLowerCase(),
    segment(identity),
    input.language !== undefined ? `lang-${segment(input.language)}` : undefined,
    params ? `params-${segment(params)}` : undefined,
  ];
  return components.filter((value): value is string => value !== undefined).join(":");
}

// Compatibility facade for existing provider call sites. New call sites should
// pass language and parameters separately through buildCacheKey.
export class SimpleKeyBuilder {
  static key(api: string, type: string, id: string | number, suffix?: string): string {
    return buildCacheKey({
      provider: api,
      resource: type,
      id,
      params: suffix === undefined ? undefined : { suffix },
    });
  }

  static tmdb(type: string, id: string | number, suffix?: string): string {
    return this.key(API_PREFIXES.TMDB, type, id, suffix);
  }

  static tvdb(type: string, id: string | number, suffix?: string, language?: string): string {
    return buildCacheKey({
      provider: API_PREFIXES.TVDB,
      resource: type,
      id,
      language,
      params: suffix === undefined ? undefined : { suffix },
    });
  }

  static wikipedia(type: string, id: string, suffix?: string): string {
    return this.key(API_PREFIXES.WIKIPEDIA, type, id, suffix);
  }
}

export const CACHE_KEYS = {
  TMDB_MOVIE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.MOVIE, id, suffix),
  TMDB_TV: (id: number, suffix?: string) => SimpleKeyBuilder.tmdb(CONTENT_TYPES.TV, id, suffix),
  TMDB_EPISODE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.EPISODE, id, suffix),
  TMDB_PERSON: (id: number, suffix?: string) =>
    SimpleKeyBuilder.tmdb(CONTENT_TYPES.PERSON, id, suffix),
  TMDB_TRENDING_MOVIES: () => SimpleKeyBuilder.tmdb(CONTENT_TYPES.TRENDING, "movies:v2"),
  TMDB_TRENDING_SHOWS: () => SimpleKeyBuilder.tmdb(CONTENT_TYPES.TRENDING, "shows:v2"),
  TVDB_AUTH_TOKEN: () => "tvdb:auth_token",
  TVDB_SERIES: (id: number, suffix?: string, language?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.SERIES, id, suffix, language),
  TVDB_MOVIE: (id: number, suffix?: string, language?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.MOVIE, id, suffix, language),
  TVDB_EPISODE: (id: number, suffix?: string, language?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.EPISODE, id, suffix, language),
  TVDB_PERSON: (id: number, suffix?: string, language?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.PERSON, id, suffix, language),
  TVDB_CHARACTER: (id: number, suffix?: string, language?: string) =>
    SimpleKeyBuilder.tvdb(CONTENT_TYPES.CHARACTER, id, suffix, language),
  TVDB_SEARCH: (query: string, suffix?: string, language?: string) =>
    buildCacheKey({
      provider: API_PREFIXES.TVDB,
      resource: CONTENT_TYPES.SEARCH,
      query,
      language,
      params: suffix === undefined ? undefined : { suffix },
    }),
  WIKIPEDIA_VOICE_ACTOR: (id: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia(CONTENT_TYPES.VOICE_ACTOR, id, suffix),
  WIKIPEDIA_ENTITY: (id: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia(CONTENT_TYPES.ENTITY, id, suffix),
  WIKIPEDIA_PAGE: (id: number, suffix?: string) =>
    SimpleKeyBuilder.wikipedia("page", id.toString(), suffix),
  WIKIPEDIA_CATEGORY: (category: string, suffix?: string) =>
    SimpleKeyBuilder.wikipedia("category", category, suffix),
  WIKIPEDIA_SEARCH: (query: string, language?: string) =>
    buildCacheKey({
      provider: API_PREFIXES.WIKIPEDIA,
      resource: CONTENT_TYPES.SEARCH,
      query: query.toLowerCase(),
      language,
    }),
} as const;

export class SimpleKeyValidator {
  static isValidKey(key: string): boolean {
    return /^[a-zA-Z0-9:_-]+$/.test(key) && key.length > 0 && key.length <= 200;
  }

  static sanitizeKey(key: string): string {
    if (this.isValidKey(key)) return key;
    const prefix = key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 150);
    return `${prefix}:${hashCacheValue(key)}`.slice(0, 200);
  }
}
