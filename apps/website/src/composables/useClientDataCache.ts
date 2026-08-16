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

export function clientCacheDelete(key: string): void {
  if (import.meta.client) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Non-fatal.
    }
  }
}

export function clientCacheDeleteByPrefix(prefix: string): void {
  if (import.meta.client) {
    try {
      const full = PREFIX + prefix;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(full)) keys.push(k);
      }
      for (const k of keys) {
        localStorage.removeItem(k);
      }
    } catch {
      // Non-fatal.
    }
  }
}

// Maps a dubbing_projects.content_type ("movie" | "tv" | "game") to the
// client cache prefix used by the detail views, and drops every locale key
// for that media so the next navigation revalidates from the (now purged) edge.
export function invalidateMediaClientCache(
  contentType: string,
  contentId: number | string,
): void {
  const path = contentType === "tv" ? "show" : contentType;
  clientCacheDeleteByPrefix(`${path}-${contentId}`);
}
