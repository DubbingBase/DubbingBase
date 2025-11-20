import { IRedisClient } from './interfaces.ts';
import { SimpleKeyBuilder, CACHE_KEYS, SimpleKeyValidator } from './cache-constants.ts';

// Debug logging function
function debugLog(message: string, data?: any) {
  console.log(`[CACHE] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// Simplified TTL presets in seconds
export const CACHE_TTL = {
  SHORT: 60 * 60,      // 1 hour
  MEDIUM: 6 * 60 * 60, // 6 hours
  LONG: 24 * 60 * 60,  // 24 hours
  EXTENDED: 7 * 24 * 60 * 60, // 7 days
} as const;

export type CacheTTLPreset = keyof typeof CACHE_TTL;

/**
 * Simple, cohesive cache utility with straightforward API
 */
export class SimpleCache {
  constructor(private redisClient: IRedisClient) {}

  /**
   * Simple cache get with error handling
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const cached = await this.redisClient.get(sanitizedKey);
      if (!cached) {
        debugLog(`Cache miss for key: ${key}`);
        return null;
      }

      const parsed = JSON.parse(cached) as T;
      debugLog(`Cache hit for key: ${key}`);
      return parsed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`Cache get failed for key ${key}`, { error: errorMessage });
      return null;
    }
  }

  /**
   * Simple cache set with TTL preset and error handling
   */
  async set<T>(key: string, data: T, ttl: CacheTTLPreset = 'MEDIUM'): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const serialized = JSON.stringify(data);
      const ttlSeconds = CACHE_TTL[ttl];
      const success = await this.redisClient.setex(sanitizedKey, ttlSeconds, serialized);

      if (success) {
        debugLog(`Cache set for key: ${key}`, { ttl: ttlSeconds });
      } else {
        debugLog(`Cache set failed for key: ${key}`);
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`Cache set failed for key ${key}`, { error: errorMessage });
      return false;
    }
  }

  /**
   * Simple cache delete
   */
  async del(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const deleted = await this.redisClient.del(sanitizedKey);
      const success = deleted > 0;
      debugLog(`Cache delete for key: ${key}`, { success, deleted });
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`Cache delete failed for key ${key}`, { error: errorMessage });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      return await this.redisClient.exists(sanitizedKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`Cache exists check failed for key ${key}`, { error: errorMessage });
      return false;
    }
  }

  /**
   * Health check for cache connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pingResult = await this.redisClient.ping();
      debugLog(`Cache health check`, { healthy: pingResult });
      return pingResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`Cache health check failed`, { error: errorMessage });
      return false;
    }
  }

  // Key generation methods using the simple key builder
  generateKey(api: string, type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.key(api, type, id, suffix);
  }

  // Convenience methods for common APIs
  tmdbKey(type: string, id: number, suffix?: string): string {
    return SimpleKeyBuilder.tmdb(type, id, suffix);
  }

  tvdbKey(type: string, id: number, suffix?: string): string {
    return SimpleKeyBuilder.tvdb(type, id, suffix);
  }

  wikipediaKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.wikipedia(type, id, suffix);
  }

  appKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.app(type, id, suffix);
  }
}

// Re-export key builder and constants for convenience
export { SimpleKeyBuilder, CACHE_KEYS } from './cache-constants.ts';