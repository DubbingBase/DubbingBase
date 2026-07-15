import { IDatabaseClient } from "./interfaces.ts";
import { ITMDBClient } from "./interfaces.ts";
import { processVoiceActor } from "./supabase-urls.ts";
import { processMedia } from "./tmdb-urls.ts";
import { TVDBClient } from "./tvdb.ts";
import { cacheUtils } from "./index.ts";

import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "./database.types.ts";

export class MediaService {
  constructor(
    private databaseClient: IDatabaseClient,
    private tmdbClient: ITMDBClient,
    private ctx: SupabaseContext<Database>,
  ) {}

  async getVoiceActorWithWorkAndMedia(voiceActorId: number) {
    const voiceActor =
      await this.databaseClient.getVoiceActorWithWork(voiceActorId);

    console.log("voiceActor", voiceActor);

    const voiceActorWithImages = processVoiceActor(this.ctx, voiceActor);

    console.log("voiceActorWithImages", voiceActorWithImages);

    // Fetch TMDB details and TVDB characters for each work item in parallel
    const mediaPromises = (voiceActor.work || []).map(async (work: any) => {
      try {
        const contentType = work.content_type as "movie" | "tv";
        const tmdbMedia = await this.tmdbClient.getMediaWithCredits(
          contentType,
          work.content_id,
        );
        
        const characterProfilePictures = await this.getCharacterProfilePictures(contentType, work.content_id, tmdbMedia);
        
        return { 
          media: processMedia(tmdbMedia),
          characterProfilePictures 
        };
      } catch (err) {
        console.error(
          `Failed to fetch TMDB/TVDB info for ${work.content_type} ${work.content_id}:`,
          err,
        );
        return null;
      }
    });

    const results = await Promise.all(mediaPromises);
    const validResults = results.filter(Boolean) as { media: any, characterProfilePictures: any[] }[];
    
    const medias = validResults.map(r => r.media);
    const characterProfilePictures = validResults.flatMap(r => r.characterProfilePictures);

    return { voiceActor: voiceActorWithImages, medias, characterProfilePictures };
  }

  private async getCharacterProfilePictures(contentType: "movie" | "tv", contentId: number, tmdbMedia: any): Promise<any[]> {
    const tvdbClient = new TVDBClient(cacheUtils);
    let characterProfilePictures: any[] = [];
    
    try {
      let tvdbId: number | null = null;
      if (tmdbMedia.external_ids?.tvdb_id) {
        tvdbId = tmdbMedia.external_ids.tvdb_id;
      } else {
        const searchQuery = tmdbMedia.title || tmdbMedia.name || tmdbMedia.original_title || tmdbMedia.original_name;
        if (searchQuery) {
          const searchResults = await tvdbClient.searchSeries(searchQuery);
          if (searchResults.data && searchResults.data.length > 0) {
            const bestMatch = searchResults.data.find((item: any) =>
              item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              searchQuery.toLowerCase().includes(item.name?.toLowerCase())
            ) || searchResults.data[0];
            tvdbId = contentType === 'movie' ? (bestMatch?.tvdb_id || bestMatch?.id) : bestMatch?.id;
          }
        }
      }

      if (tvdbId) {
        const cacheKey = `tvdb:${contentType}:characters:${tvdbId}`;
        const cachedCharacters = await cacheUtils.get(cacheKey);
        
        if (cachedCharacters) {
          return cachedCharacters as any[];
        }

        let characters: any[] = [];
        if (contentType === 'movie') {
          const res = await tvdbClient.getMovieById(tvdbId, { meta: "translations", short: false });
          characters = res.data.characters || [];
        } else {
          const res = await tvdbClient.getSeriesById(tvdbId, { meta: "episodes", short: false });
          characters = res.data.characters || [];
        }

        if (characters && characters.length > 0) {
          characterProfilePictures = characters
            .filter((character: any) => character.image)
            .map((character: any) => ({
              id: character.id,
              name: character.name,
              image: character.image,
              tvdbPeopleId: character.peopleId,
              movieId: contentType === 'movie' ? contentId : undefined,
              showId: contentType === 'tv' ? contentId : undefined,
            }));
            
          cacheUtils.set(cacheKey, characterProfilePictures, "SHORT").catch(() => {});
        }
      }
    } catch (e) {
      console.error(`Error fetching character profile pictures for ${contentType} ${contentId}:`, e);
    }
    
    return characterProfilePictures;
  }

  async getMediaWithVoiceActors(
    contentType: "movie" | "tv",
    contentId: number,
  ) {
    const media = await this.tmdbClient.getMediaWithCredits(
      contentType,
      contentId,
    );
    const voiceActors =
      await this.databaseClient.getWorkWithVoiceActors(contentId);

    // Process image URLs in the media data
    const processedMedia = processMedia(media);

    return { media: processedMedia, voice_actors: voiceActors };
  }

  async getMediaWithVoiceActorsExtended(
    contentType: "movie" | "tv" | "season" | "episode",
    id: number,
    seasonNumber?: number,
    episodeNumber?: number,
  ) {
    let media;

    switch (contentType) {
      case "movie":
        media = await this.tmdbClient.getMediaWithCredits("movie", id);
        break;
      case "tv":
        media = await this.tmdbClient.getMediaWithCredits("tv", id);
        break;
      case "season":
        if (!seasonNumber) {
          throw new Error("seasonNumber required for season contentType");
        }
        media = await this.tmdbClient.getSeasonWithCredits(id, seasonNumber);
        break;
      case "episode":
        if (!seasonNumber || !episodeNumber) {
          throw new Error(
            "seasonNumber and episodeNumber required for episode contentType",
          );
        }
        media = await this.tmdbClient.getEpisodeWithCredits(
          id,
          seasonNumber,
          episodeNumber,
        );
        break;
    }

    // Process image URLs in the media data
    const processedMedia = processMedia(media);
    const voiceActors = await this.databaseClient.getWorkWithVoiceActors(id);

    return { media: processedMedia, voice_actors: voiceActors };
  }
}
