import { ofetch } from "ofetch";
import type { Podcast, PodcastEpisode } from "@app/shared-logic";
import { SimpleCache } from "../cache";

export interface ITunesPodcastResult {
  collectionId: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  genres?: string[];
  description?: string;
  shortDescription?: string;
}

export class PodcastClient {
  private baseUrl = "https://itunes.apple.com";

  constructor(private cache: SimpleCache) {}

  async searchPodcasts(query: string, limit = 20): Promise<Podcast[]> {
    if (!query || query.trim().length < 2) return [];

    const trimmedQuery = query.trim();
    const cacheKey = `itunes:search:podcast:${trimmedQuery}:${limit}`;
    const cached = await this.cache.get<Podcast[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await ofetch<{
        resultCount: number;
        results: ITunesPodcastResult[];
      }>(`${this.baseUrl}/search`, {
        params: {
          term: trimmedQuery,
          media: "podcast",
          entity: "podcast",
          limit,
        },
        timeout: 5000,
      });

      if (!response?.results) return [];

      const podcasts = response.results.map((item) => ({
        id: item.collectionId || item.trackId || 0,
        title: item.collectionName || item.trackName || "Podcast",
        author: item.artistName || "",
        feed_url: item.feedUrl || "",
        cover_url: item.artworkUrl600 || item.artworkUrl100 || null,
        episodes_count: item.trackCount || 0,
        release_date: item.releaseDate || "",
        genres:
          item.genres || (item.primaryGenreName ? [item.primaryGenreName] : []),
        media_type: "podcast" as const,
      }));

      await this.cache.set(cacheKey, podcasts, "SHORT");
      return podcasts;
    } catch (err) {
      console.error("iTunes podcast search failed:", err);
      return [];
    }
  }

  async getPodcast(id: number): Promise<Podcast | null> {
    const cacheKey = `itunes:podcast:${id}`;
    const cached = await this.cache.get<Podcast>(cacheKey);
    if (cached) return cached;

    try {
      const response = await ofetch<{
        resultCount: number;
        results: any[];
      }>(`${this.baseUrl}/lookup`, {
        params: {
          id,
          entity: "podcastEpisode",
          limit: 50,
        },
        timeout: 6000,
      });

      if (!response?.results || response.results.length === 0) return null;

      const podcastHeader = response.results[0] as ITunesPodcastResult;
      const rawEpisodes = response.results.slice(1);

      const episodes: PodcastEpisode[] = rawEpisodes.map((ep: any) => ({
        id: ep.trackId || ep.collectionId || 0,
        title: ep.trackName || "Épisode",
        description: ep.description || ep.shortDescription || "",
        release_date: ep.releaseDate || "",
        duration: ep.trackTimeMillis
          ? Math.round(ep.trackTimeMillis / 60000)
          : undefined,
        audio_url: ep.episodeUrl || "",
      }));

      const podcast = {
        id: podcastHeader.collectionId || podcastHeader.trackId || id,
        title:
          podcastHeader.collectionName || podcastHeader.trackName || "Podcast",
        author: podcastHeader.artistName || "",
        feed_url: podcastHeader.feedUrl || "",
        cover_url:
          podcastHeader.artworkUrl600 || podcastHeader.artworkUrl100 || null,
        episodes_count: podcastHeader.trackCount || episodes.length,
        release_date: podcastHeader.releaseDate || "",
        genres:
          podcastHeader.genres ||
          (podcastHeader.primaryGenreName
            ? [podcastHeader.primaryGenreName]
            : []),
        description: podcastHeader.description || "",
        episodes,
        media_type: "podcast" as const,
      };

      await this.cache.set(cacheKey, podcast, "MEDIUM");
      return podcast;
    } catch (err) {
      console.error(`iTunes lookup for podcast ${id} failed:`, err);
      return {
        id,
        title: `Podcast #${id}`,
        media_type: "podcast" as const,
      };
    }
  }
}
