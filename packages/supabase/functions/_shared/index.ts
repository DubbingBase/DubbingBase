import { DatabaseClient } from './database.ts';
import { TMDBClient } from './tmdb.ts';
import { TVDBClient } from './tvdb.ts';
import { RedisClient } from './redis.ts';
import { SimpleCache, CACHE_TTL } from './cache-utils.ts';
import { WikipediaCache } from './wikipedia-cache.ts';
import { MediaService } from './media-service.ts';
import { IDatabaseClient } from './interfaces.ts';
import { ITMDBClient } from './interfaces.ts';
import { ITVDBClient } from './interfaces.ts';
import { IRedisClient } from './interfaces.ts';
import { CACHE_KEYS, SimpleKeyBuilder } from './cache-constants.ts';

// Export clients as implementations of their respective interfaces
export const databaseClient: IDatabaseClient = new DatabaseClient();
export const redisClient: IRedisClient = new RedisClient();

// Export simplified cache instance
export const cacheUtils = new SimpleCache(redisClient);

export const tmdbClient: ITMDBClient = new TMDBClient(cacheUtils);
export const tvdbClient: ITVDBClient = new TVDBClient(cacheUtils);

// Export Wikipedia cache instance
export const wikipediaCache = new WikipediaCache(cacheUtils);

// Export MediaService instance
export const mediaService = new MediaService(databaseClient, tmdbClient);

// Export classes for direct instantiation if needed
export { DatabaseClient } from './database.ts';
export { TMDBClient } from './tmdb.ts';
export { TVDBClient } from './tvdb.ts';
export { RedisClient } from './redis.ts';
export { SimpleCache } from './cache-utils.ts';
export { WikipediaCache } from './wikipedia-cache.ts';
export { MediaService } from './media-service.ts';

// Export interfaces
export type { IDatabaseClient, ITMDBClient, ITVDBClient, IRedisClient } from './interfaces.ts';

// Export cache utilities and constants
export { CACHE_TTL } from './cache-utils.ts';
export { CACHE_KEYS, SimpleKeyBuilder } from './cache-constants.ts';

// Export trending processor utilities
export {
  processTrendingMedia,
  processMediaItems,
  generateSummary,
  sendNotification,
  validateEnvironment,
  fetchTrendingMedia
} from './trending-processor.ts';

export type {
  MediaItem,
  ProcessingResult,
  TrendingProcessorConfig,
  TrendingProcessorResult
} from './trending-processor.ts';
