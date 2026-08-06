import { TMDBClient } from "./tmdb.ts";
import { TVDBClient } from "./tvdb.ts";
import { IgdbClient } from "./igdb.ts";
import { RedisClient } from "./redis.ts";
import { SimpleCache } from "./cache-utils.ts";
import { WikipediaCache } from "./wikipedia-cache.ts";
import { ITMDBClient } from "./interfaces.ts";
import { ITVDBClient } from "./interfaces.ts";
import { IIgdbClient } from "./interfaces.ts";
import { IRedisClient } from "./interfaces.ts";

// Export clients as implementations of their respective interfaces
export const redisClient: IRedisClient = new RedisClient();

// Export simplified cache instance
export const cacheUtils = new SimpleCache(redisClient);

export const tmdbClient: ITMDBClient = new TMDBClient(cacheUtils);
export const tvdbClient: ITVDBClient = new TVDBClient(cacheUtils);
export const igdbClient: IIgdbClient = new IgdbClient(cacheUtils);

// Export Wikipedia cache instance
export const wikipediaCache = new WikipediaCache(cacheUtils);

// Export classes for direct instantiation if needed
export { DatabaseClient } from "./database.ts";
export { TMDBClient } from "./tmdb.ts";
export { TVDBClient } from "./tvdb.ts";
export { IgdbClient } from "./igdb.ts";
export { RedisClient } from "./redis.ts";
export { SimpleCache } from "./cache-utils.ts";
export { WikipediaCache } from "./wikipedia-cache.ts";
export { MediaService } from "./media-service.ts";

// Export interfaces
export type {
  IRedisClient,
  ITMDBClient,
  ITVDBClient,
  IIgdbClient,
} from "./interfaces.ts";

// Export cache utilities and constants
export { CACHE_TTL } from "./cache-utils.ts";
export { CACHE_KEYS, SimpleKeyBuilder } from "./cache-constants.ts";
