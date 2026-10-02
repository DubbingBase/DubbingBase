// Cache key schema is versioned so stale or ambiguous keys expire naturally.
export const CACHE_SCHEMA_VERSION = "3";

export interface CacheWriteDimensions {
  provider: string;
  resource: string;
}

const CACHE_LOG_PROVIDERS = new Set([
  "tmdb",
  "tvdb",
  "igdb",
  "wikipedia",
  "openlibrary",
  "podcast",
]);
const CACHE_LOG_RESOURCES = new Set([
  "auth_token",
  "author",
  "characters-by-tmdb-id",
  "entity",
  "voice-actor-url",
]);

/** Extracts only allowlisted labels; cache identity and params are never returned. */
export function classifyCacheWriteKey(key: string): CacheWriteDimensions {
  const match = /^external:v\d+:([^:]+):([^:]+):/.exec(key);
  const legacyTokenMatch = /^(igdb|tvdb):(auth_token)$/.exec(key);
  const provider = match?.[1] ?? legacyTokenMatch?.[1];
  const resource = match?.[2] ?? legacyTokenMatch?.[2];

  return {
    provider: provider && CACHE_LOG_PROVIDERS.has(provider) ? provider : "other",
    resource: resource && CACHE_LOG_RESOURCES.has(resource) ? resource : "other",
  };
}

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

/** Shared key strategy for persistent mappings and provider authentication tokens. */
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
