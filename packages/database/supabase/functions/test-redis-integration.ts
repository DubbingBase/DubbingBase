import { RedisClient } from './_shared/redis.ts';
import { SimpleCache, CACHE_TTL } from './_shared/cache-utils.ts';
import { TMDBClient } from './_shared/tmdb.ts';
import { TVDBClient } from './_shared/tvdb.ts';
import { WikipediaCache } from './_shared/wikipedia-cache.ts';
import { CACHE_KEYS, SimpleKeyBuilder } from './_shared/cache-constants.ts';

// Test result interface
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

// Test suite results
interface TestSuiteResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  results: TestResult[];
}

// Test configuration
const TEST_CONFIG = {
  PERFORMANCE_ITERATIONS: 10,
  CACHE_TEST_TTL: 300, // 5 minutes for test data
  SAMPLE_MOVIE_ID: 550, // Fight Club - well known movie
  SAMPLE_TV_ID: 1399,   // Game of Thrones - well known series
  SAMPLE_TVDB_SERIES_ID: 121361, // Breaking Bad
  WIKIPEDIA_TEST_ENTITY: "Q7747", // Sample Wikidata entity
};

/**
 * Comprehensive Redis Integration Test Suite
 * Tests Redis connection, caching, and all API integrations
 */
export class RedisIntegrationTestSuite {
  private redisClient: RedisClient;
  private cache: SimpleCache;
  private tmdbClient: TMDBClient;
  private tvdbClient: TVDBClient;
  private wikipediaCache: WikipediaCache;
  private results: TestResult[] = [];

  constructor() {
    this.redisClient = new RedisClient();
    this.cache = new SimpleCache(this.redisClient);
    this.tmdbClient = new TMDBClient(this.cache);
    this.tvdbClient = new TVDBClient(this.cache);
    this.wikipediaCache = new WikipediaCache(this.cache);
  }

  /**
   * Run all tests and return comprehensive results
   */
  async runAllTests(): Promise<TestSuiteResults> {
    console.log('[REDIS TEST SUITE] Starting comprehensive Redis integration tests...');

    const startTime = Date.now();

    try {
      // Run all test categories
      await this.testRedisConnection();
      await this.testBasicCacheOperations();
      await this.testTmdbCaching();
      await this.testTvdbCaching();
      await this.testWikipediaCaching();
      await this.testErrorHandling();
      await this.testPerformance();

    } catch (error) {
      console.error('[REDIS TEST SUITE] Test suite failed:', error);
      this.addResult('test-suite-overall', false, Date.now() - startTime, String(error));
    }

    const totalDuration = Date.now() - startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;

    const suiteResults: TestSuiteResults = {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      totalDuration,
      results: this.results,
    };

    console.log('[REDIS TEST SUITE] Test suite completed:', suiteResults);
    return suiteResults;
  }

  /**
   * Test Redis connection and basic connectivity
   */
  private async testRedisConnection(): Promise<void> {
    const testName = 'redis-connection';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing Redis connection...`);

      // Test ping
      const pingResult = await this.redisClient.ping();
      if (!pingResult) {
        throw new Error('Redis ping failed');
      }

      // Test basic set/get
      const testKey = 'test:connection';
      const testValue = 'test-value';
      const setResult = await this.redisClient.set(testKey, testValue);
      if (!setResult) {
        throw new Error('Redis set operation failed');
      }

      const getResult = await this.redisClient.get(testKey);
      if (getResult !== testValue) {
        throw new Error('Redis get operation returned incorrect value');
      }

      // Cleanup
      await this.redisClient.del(testKey);

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        pingResult,
        setResult,
        getResult,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test basic cache operations (get, set, delete, exists, ttl)
   */
  private async testBasicCacheOperations(): Promise<void> {
    const testName = 'basic-cache-operations';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing basic cache operations...`);

      const testKey = 'test:cache:operations';
      const testData = { message: 'test data', timestamp: Date.now() };

      // Test set operation
      const setResult = await this.cache.set(testKey, testData, 'SHORT');
      if (!setResult) {
        throw new Error('Cache set operation failed');
      }

      // Test exists operation
      const existsResult = await this.cache.exists(testKey);
      if (!existsResult) {
        throw new Error('Cache exists check failed');
      }

      // Test get operation
      const getResult = await this.cache.get(testKey) as typeof testData | null;
      if (!getResult || getResult.message !== testData.message) {
        throw new Error('Cache get operation failed or returned incorrect data');
      }

      // Test TTL operation
      const ttlResult = await this.redisClient.ttl(testKey);
      if (ttlResult <= 0) {
        throw new Error('Cache TTL check failed');
      }

      // Test delete operation
      const delResult = await this.cache.del(testKey);
      if (!delResult) {
        throw new Error('Cache delete operation failed');
      }

      // Verify deletion
      const existsAfterDelete = await this.cache.exists(testKey);
      if (existsAfterDelete) {
        throw new Error('Cache key still exists after deletion');
      }

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        setResult,
        existsResult,
        getResult,
        ttlResult,
        delResult,
        existsAfterDelete,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test TMDB API caching functionality
   */
  private async testTmdbCaching(): Promise<void> {
    const testName = 'tmdb-api-caching';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing TMDB API caching...`);

      // Test cache key generation
      const movieKey = this.cache.tmdbKey('movie', TEST_CONFIG.SAMPLE_MOVIE_ID, 'details');
      const tvKey = this.cache.tmdbKey('tv', TEST_CONFIG.SAMPLE_TV_ID, 'details');

      if (!movieKey.startsWith('tmdb:movie:550')) {
        throw new Error('TMDB movie cache key generation failed');
      }

      if (!tvKey.startsWith('tmdb:tv:1399')) {
        throw new Error('TMDB TV cache key generation failed');
      }

      // Test movie details caching (using mock data to avoid real API calls)
      const mockMovieData = {
        id: TEST_CONFIG.SAMPLE_MOVIE_ID,
        title: 'Test Movie',
        overview: 'Test overview',
      };

      const cacheSetResult = await this.cache.set(movieKey, mockMovieData, 'MEDIUM');
      if (!cacheSetResult) {
        throw new Error('TMDB movie cache set failed');
      }

      const cacheGetResult = await this.cache.get(movieKey) as { id: number } | null;
      if (!cacheGetResult || cacheGetResult.id !== TEST_CONFIG.SAMPLE_MOVIE_ID) {
        throw new Error('TMDB movie cache get failed');
      }

      // Test cache hit scenario
      const cacheHitResult = await this.cache.get(movieKey);
      if (!cacheHitResult) {
        throw new Error('TMDB cache hit scenario failed');
      }

      // Cleanup
      await this.cache.del(movieKey);
      await this.cache.del(tvKey);

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        movieKey,
        tvKey,
        cacheSetResult,
        cacheGetResult,
        cacheHitResult,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test TVDB API caching functionality
   */
  private async testTvdbCaching(): Promise<void> {
    const testName = 'tvdb-api-caching';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing TVDB API caching...`);

      // Test cache key generation
      const seriesKey = this.cache.tvdbKey('series', TEST_CONFIG.SAMPLE_TVDB_SERIES_ID);
      const searchKey = this.cache.generateKey('tvdb', 'search', 'test-query');

      if (!seriesKey.startsWith('tvdb:series:121361')) {
        throw new Error('TVDB series cache key generation failed');
      }

      if (!searchKey.startsWith('tvdb:search:test-query')) {
        throw new Error('TVDB search cache key generation failed');
      }

      // Test series data caching (using mock data)
      const mockSeriesData = {
        id: TEST_CONFIG.SAMPLE_TVDB_SERIES_ID,
        name: 'Test Series',
        overview: 'Test overview',
      };

      const cacheSetResult = await this.cache.set(seriesKey, mockSeriesData, 'SHORT');
      if (!cacheSetResult) {
        throw new Error('TVDB series cache set failed');
      }

      const cacheGetResult = await this.cache.get(seriesKey) as { id: number } | null;
      if (!cacheGetResult || cacheGetResult.id !== TEST_CONFIG.SAMPLE_TVDB_SERIES_ID) {
        throw new Error('TVDB series cache get failed');
      }

      // Test search caching
      const mockSearchData = {
        query: 'test-query',
        results: [{ id: 1, name: 'Test Result' }],
      };

      const searchSetResult = await this.cache.set(searchKey, mockSearchData, 'MEDIUM');
      if (!searchSetResult) {
        throw new Error('TVDB search cache set failed');
      }

      // Cleanup
      await this.cache.del(seriesKey);
      await this.cache.del(searchKey);

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        seriesKey,
        searchKey,
        cacheSetResult,
        cacheGetResult,
        searchSetResult,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test Wikipedia API caching functionality
   */
  private async testWikipediaCaching(): Promise<void> {
    const testName = 'wikipedia-api-caching';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing Wikipedia API caching...`);

      // Test cache key generation
      const entityKey = this.cache.wikipediaKey('entity', TEST_CONFIG.WIKIPEDIA_TEST_ENTITY);
      const searchKey = this.cache.generateKey('wikipedia', 'search', 'test-search');

      if (!entityKey.startsWith('wikipedia:entity:Q7747')) {
        throw new Error('Wikipedia entity cache key generation failed');
      }

      if (!searchKey.startsWith('wikipedia:search:test-search')) {
        throw new Error('Wikipedia search cache key generation failed');
      }

      // Test entity data caching (using mock data)
      const mockEntityData = {
        id: TEST_CONFIG.WIKIPEDIA_TEST_ENTITY,
        labels: { en: { value: 'Test Entity' } },
      };

      const cacheSetResult = await this.cache.set(entityKey, mockEntityData, 'EXTENDED');
      if (!cacheSetResult) {
        throw new Error('Wikipedia entity cache set failed');
      }

      const cacheGetResult = await this.cache.get(entityKey) as { id: string } | null;
      if (!cacheGetResult || cacheGetResult.id !== TEST_CONFIG.WIKIPEDIA_TEST_ENTITY) {
        throw new Error('Wikipedia entity cache get failed');
      }

      // Test search caching
      const mockSearchData = {
        query: 'test-search',
        results: [{ id: 'Q1', label: 'Test Result' }],
      };

      const searchSetResult = await this.cache.set(searchKey, mockSearchData, 'MEDIUM');
      if (!searchSetResult) {
        throw new Error('Wikipedia search cache set failed');
      }

      // Cleanup
      await this.cache.del(entityKey);
      await this.cache.del(searchKey);

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        entityKey,
        searchKey,
        cacheSetResult,
        cacheGetResult,
        searchSetResult,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test error handling scenarios
   */
  private async testErrorHandling(): Promise<void> {
    const testName = 'error-handling';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing error handling scenarios...`);

      // Test cache operations with invalid keys
      const invalidKey = 'test:invalid:key:with:special:chars:🚫';

      // These should not throw errors but handle gracefully
      const getResult = await this.cache.get(invalidKey);
      const setResult = await this.cache.set(invalidKey, { test: 'data' });
      const existsResult = await this.cache.exists(invalidKey);
      const delResult = await this.cache.del(invalidKey);

      // Test Redis operations with malformed data
      const malformedData = { test: 'data', invalid: undefined };

      try {
        await this.cache.set('test:malformed', malformedData);
        // Test passed - cache handled the data
      } catch (error) {
        // Expected for some malformed data
        console.log('[REDIS TEST] Malformed data handled as expected');
      }

      // Test cache health check
      const healthResult = await this.cache.healthCheck();
      // Health check result depends on Redis availability

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        getResult,
        setResult,
        existsResult,
        delResult,
        healthResult,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Test cache performance vs direct operations
   */
  private async testPerformance(): Promise<void> {
    const testName = 'performance';
    const startTime = Date.now();

    try {
      console.log(`[REDIS TEST] Testing cache performance...`);

      const testKey = 'test:performance';
      const testData = {
        large: 'x'.repeat(1000), // 1KB of data
        nested: { data: 'x'.repeat(500) },
        array: new Array(100).fill('test-data'),
      };

      // Test cache write performance
      const cacheWriteStart = Date.now();
      for (let i = 0; i < TEST_CONFIG.PERFORMANCE_ITERATIONS; i++) {
        const key = `${testKey}:write:${i}`;
        await this.cache.set(key, { ...testData, iteration: i });
      }
      const cacheWriteTime = Date.now() - cacheWriteStart;

      // Test cache read performance
      const cacheReadStart = Date.now();
      for (let i = 0; i < TEST_CONFIG.PERFORMANCE_ITERATIONS; i++) {
        const key = `${testKey}:write:${i}`;
        await this.cache.get(key);
      }
      const cacheReadTime = Date.now() - cacheReadStart;

      // Test cache hit performance (read same data multiple times)
      const hitTestKey = `${testKey}:hit-test`;
      await this.cache.set(hitTestKey, testData);

      const cacheHitStart = Date.now();
      for (let i = 0; i < TEST_CONFIG.PERFORMANCE_ITERATIONS; i++) {
        await this.cache.get(hitTestKey);
      }
      const cacheHitTime = Date.now() - cacheHitStart;

      // Cleanup
      for (let i = 0; i < TEST_CONFIG.PERFORMANCE_ITERATIONS; i++) {
        await this.cache.del(`${testKey}:write:${i}`);
      }
      await this.cache.del(hitTestKey);

      // Calculate performance metrics
      const avgWriteTime = cacheWriteTime / TEST_CONFIG.PERFORMANCE_ITERATIONS;
      const avgReadTime = cacheReadTime / TEST_CONFIG.PERFORMANCE_ITERATIONS;
      const avgHitTime = cacheHitTime / TEST_CONFIG.PERFORMANCE_ITERATIONS;

      // Cache hits should be significantly faster than writes
      const performanceRatio = avgWriteTime / Math.max(avgHitTime, 1);

      this.addResult(testName, true, Date.now() - startTime, undefined, {
        iterations: TEST_CONFIG.PERFORMANCE_ITERATIONS,
        avgWriteTime,
        avgReadTime,
        avgHitTime,
        performanceRatio,
        dataSize: JSON.stringify(testData).length,
      });

    } catch (error) {
      this.addResult(testName, false, Date.now() - startTime, String(error));
    }
  }

  /**
   * Helper method to add test results
   */
  private addResult(
    testName: string,
    passed: boolean,
    duration: number,
    error?: string,
    details?: any
  ): void {
    this.results.push({
      testName,
      passed,
      duration,
      error,
      details,
    });

    const status = passed ? 'PASSED' : 'FAILED';
    console.log(`[REDIS TEST] ${testName}: ${status} (${duration}ms)`);

    if (error) {
      console.error(`[REDIS TEST] ${testName} error:`, error);
    }

    if (details) {
      console.log(`[REDIS TEST] ${testName} details:`, details);
    }
  }
}

/**
 * Main test function - can be called directly
 */
export async function testRedisIntegration(): Promise<TestSuiteResults> {
  const testSuite = new RedisIntegrationTestSuite();
  return await testSuite.runAllTests();
}

// Export for use in other modules
export { TEST_CONFIG };