import type { CachePolicy, CacheTTLPreset } from "../cache";

export interface CacheFetchOptions {
  ttl?: CacheTTLPreset;
  cachePolicy?: CachePolicy;
}
