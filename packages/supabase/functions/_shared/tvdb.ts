import { ITVDBClient } from './interfaces.ts';
import { SimpleCache, CacheTTLPreset } from './cache-utils.ts';
import { IRedisClient } from './interfaces.ts';

// Debug logging function
function debugLog(message: string, data?: any) {
  console.log(`[TVDB] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

export class TVDBClient implements ITVDBClient {
  private apiKey: string;
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private cache: SimpleCache;

  constructor(cache: SimpleCache) {
    this.apiKey = Deno.env.get('TVDB_API_KEY')!;
    this.baseUrl = 'https://api4.thetvdb.com/v4';
    this.cache = cache;
    debugLog('TVDB Client initialized', {
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl,
      hasCache: true
    });
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    debugLog('Authenticating with TVDB API');

    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        apikey: this.apiKey
      }),
    });

    if (!response.ok) {
      throw new Error(`TVDB authentication failed: ${response.status}`);
    }

    const authData = await response.json();
    this.token = authData.data.token;
    // Token expires in 24 hours, set expiry to 23 hours for safety margin
    this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

    debugLog('TVDB authentication successful', {
      hasToken: !!this.token,
      expiresAt: this.tokenExpiry
    });

    return this.token!;
  }

  async get(endpoint: string, params?: Record<string, string>) {
    const token = await this.authenticate();

    const url = new URL(`${this.baseUrl}/${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TVDB API error: ${response.status}`);
    }

    return response.json();
  }

  async getSeriesById(seriesId: number, extended?: { meta?: "episodes" | 'translations', short?: boolean }): Promise<any> {
    const cacheKey = this.cache.tvdbKey('series', seriesId, extended ? `extended:${extended.meta || 'none'}:${extended.short}` : undefined);

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TVDB cache hit for series ${seriesId}`, { extended: !!extended });
      return cached;
    }

    // Cache miss - fetch from API
    let result: any;
    if (extended) {
       result = await this.get(`series/${seriesId}/extended`, {
         extended: extended.meta || '',
         short: extended.short?.toString() || ''
       });
    } else {
       result = await this.get(`series/${seriesId}`);
    }

    // Cache the result with SHORT TTL (2 hours for series data)
    await this.cache.set(cacheKey, result, 'SHORT');
    debugLog(`TVDB cache set for series ${seriesId}`, { extended: !!extended });

    return result;
  }

  async getMovieById(movieId: number, extended?: { meta?: 'translations', short?: boolean }): Promise<any> {
    const cacheKey = this.cache.tvdbKey('movie', movieId, extended ? `extended:${extended.meta || 'none'}:${extended.short}` : undefined);

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TVDB cache hit for movie ${movieId}`, { extended: !!extended });
      return cached;
    }

    // Cache miss - fetch from API
    let result: any;
    if (extended) {
       result = await this.get(`movies/${movieId}/extended`, {
         extended: extended.meta || '',
         short: extended.short?.toString() || ''
       });
    } else {
       result = await this.get(`movies/${movieId}`);
    }

    // Cache the result with SHORT TTL (2 hours for movie data)
    await this.cache.set(cacheKey, result, 'SHORT');
    debugLog(`TVDB cache set for movie ${movieId}`, { extended: !!extended });

    return result;
  }

  async getEpisodesBySeries(seriesId: number, season?: number): Promise<any> {
    const endpoint = season
      ? `series/${seriesId}/episodes/${season}`
      : `series/${seriesId}/episodes`;
    return this.get(endpoint);
  }

  async getCharacterById(characterId: number): Promise<any> {
    return this.get(`characters/${characterId}`);
  }

  async getCharactersBySeries(seriesId: number): Promise<any> {
    const cacheKey = this.cache.tvdbKey('series', seriesId, 'characters');

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TVDB cache hit for series characters ${seriesId}`);
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`series/${seriesId}/characters`);

    // Cache the result with SHORT TTL (2 hours for character data)
    await this.cache.set(cacheKey, result, 'SHORT');
    debugLog(`TVDB cache set for series characters ${seriesId}`);

    return result;
  }
  async getCharactersByMovie(movieId: number): Promise<any> {
    const cacheKey = this.cache.tvdbKey('movie', movieId, 'characters');

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TVDB cache hit for movie characters ${movieId}`);
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`movies/${movieId}/characters`);

    // Cache the result with SHORT TTL (2 hours for character data)
    await this.cache.set(cacheKey, result, 'SHORT');
    debugLog(`TVDB cache set for movie characters ${movieId}`);

    return result;
  }

  async getPersonById(personId: number): Promise<any> {
    return this.get(`people/${personId}`);
  }

  async searchSeries(query: string): Promise<any> {
    const cacheKey = this.cache.generateKey('tvdb', 'search', query.toLowerCase().trim());

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TVDB cache hit for search query: ${query}`);
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get('search', { query });

    // Cache the result with MEDIUM TTL (6 hours for search results)
    await this.cache.set(cacheKey, result, 'MEDIUM');
    debugLog(`TVDB cache set for search query: ${query}`);

    return result;
  }
}
