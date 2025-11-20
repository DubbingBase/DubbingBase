export interface IDatabaseClient {
  getWorkWithVoiceActors(contentId: number): Promise<any>;
  getVoiceActorWithWork(voiceActorId: number): Promise<any>;
  getWorkByActor(actorId: number): Promise<any>;
  getWorkVotes(workIds: number[], userId?: string): Promise<Record<number, { up_count: number; down_count: number; user_vote: string | null }>>;
}

export interface ITMDBClient {
  get(endpoint: string, params?: Record<string, string>): Promise<any>;
  getMediaWithCredits(contentType: 'movie' | 'tv', id: number): Promise<any>;
  getSeasonWithCredits(seriesId: number, seasonNumber: number): Promise<any>;
  getEpisodeWithCredits(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<any>;
  fetchMediaDetails(contentId: number, contentType: string): Promise<any>;
  fetchMediaCredits(mediaType: string, mediaId: number): Promise<any>;
  getCached?(endpoint: string, params?: Record<string, string>): Promise<any>;
  setCache?(key: string, data: any, ttl: string): Promise<void>;
  clearCache?(key: string): Promise<void>;
}

export interface ITVDBClient {
  get(endpoint: string, params?: Record<string, string>): Promise<any>;
  getSeriesById(seriesId: number): Promise<any>;
  getEpisodesBySeries(seriesId: number, season?: number): Promise<any>;
  getCharacterById(characterId: number): Promise<any>;
  getCharactersBySeries(seriesId: number): Promise<any>;
  getPersonById(personId: number): Promise<any>;
  searchSeries(query: string): Promise<any>;
  getCached?(endpoint: string, params?: Record<string, string>): Promise<any>;
  setCache?(key: string, data: any, ttl: string): Promise<void>;
  clearCache?(key: string): Promise<void>;
}

export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<boolean>;
  setex(key: string, ttl: number, value: string): Promise<boolean>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<boolean>;
  ping(): Promise<boolean>;
}
