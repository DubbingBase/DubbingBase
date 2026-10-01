export interface CacheFetchOptions {
  forceRefresh?: boolean;
  /** Persist fetched data to KV; defaults to true. */
  writeCache?: boolean;
}
