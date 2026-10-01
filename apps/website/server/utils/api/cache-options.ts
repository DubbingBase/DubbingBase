import type { CachePolicy } from "../cache";

export interface CacheFetchOptions {
  /** Provider persistence policy; defaults to persistent KV when omitted. */
  cachePolicy?: CachePolicy;
  forceRefresh?: boolean;
  /** Persist fetched data to KV; defaults to true. */
  writeCache?: boolean;
}
