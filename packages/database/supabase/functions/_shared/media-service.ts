import { IDatabaseClient } from "./interfaces.ts";
import { ITMDBClient } from "./interfaces.ts";
import { processVoiceActor } from "./supabase-urls.ts";
import { processMedia } from "./tmdb-urls.ts";

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

    // Fetch TMDB details for each work item in parallel, using cached getMediaWithCredits
    const mediaPromises = (voiceActor.work || []).map(async (work: any) => {
      try {
        const tmdbMedia = await this.tmdbClient.getMediaWithCredits(
          work.content_type as "movie" | "tv",
          work.content_id,
        );
        return processMedia(tmdbMedia);
      } catch (err) {
        console.error(
          `Failed to fetch TMDB info for ${work.content_type} ${work.content_id}:`,
          err,
        );
        return null;
      }
    });

    const results = await Promise.all(mediaPromises);
    const medias = results.filter(Boolean);

    return { voiceActor: voiceActorWithImages, medias };
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
