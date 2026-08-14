const PREFIX = "db-cache:";

export function clientCacheGet<T>(key: string): T | undefined {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return undefined;
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function clientCacheSet(key: string, value: unknown): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Quota or serialization failure — non-fatal, just skip caching.
    }
  }
}
