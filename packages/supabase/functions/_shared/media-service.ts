import { IDatabaseClient } from './interfaces.ts';
import { ITMDBClient } from './interfaces.ts';
import { buildSupabaseImageUrl, processVoiceActor, STORAGE_BUCKETS } from './supabase-urls.ts';
import { processMedia } from './tmdb-urls.ts';

export class MediaService {
  constructor(
    private databaseClient: IDatabaseClient,
    private tmdbClient: ITMDBClient
  ) {}

  async getVoiceActorWithWorkAndMedia(voiceActorId: number) {
    const voiceActor = await this.databaseClient.getVoiceActorWithWork(voiceActorId);

    console.log('voiceActor', voiceActor)

    const voiceActorWithImages = processVoiceActor(voiceActor);

    console.log('voiceActorWithImages', voiceActorWithImages)

    // Fetch TMDB details for each work item
    const medias = [];
    for (const work of voiceActor.work) {
      const tmdbMedia = await this.tmdbClient.get(`${work.content_type}/${work.content_id}`, {
        append_to_response: 'credits,external_ids'
      });

      const processedMedia = processMedia(tmdbMedia);

      medias.push(processedMedia);
    }

    return { voiceActor: voiceActorWithImages, medias };
  }

  async getMediaWithVoiceActors(contentType: 'movie' | 'tv', contentId: number) {
    const media = await this.tmdbClient.getMediaWithCredits(contentType, contentId);
    const voiceActors = await this.databaseClient.getWorkWithVoiceActors(contentId);

    // Process image URLs in the media data
    const processedMedia = processMedia(media);

    return { media: processedMedia, voice_actors: voiceActors };
  }

  async getMediaWithVoiceActorsExtended(
    contentType: 'movie' | 'tv' | 'season' | 'episode',
    id: number,
    seasonNumber?: number,
    episodeNumber?: number
  ) {
    let media;

    switch (contentType) {
      case 'movie':
        media = await this.tmdbClient.getMediaWithCredits('movie', id);
        break;
      case 'tv':
        media = await this.tmdbClient.getMediaWithCredits('tv', id);
        break;
      case 'season':
        if (!seasonNumber) throw new Error('seasonNumber required for season contentType');
        media = await this.tmdbClient.getSeasonWithCredits(id, seasonNumber);
        break;
      case 'episode':
        if (!seasonNumber || !episodeNumber) {
          throw new Error('seasonNumber and episodeNumber required for episode contentType');
        }
        media = await this.tmdbClient.getEpisodeWithCredits(id, seasonNumber, episodeNumber);
        break;
    }

    // Process image URLs in the media data
    const processedMedia = processMedia(media);
    const voiceActors = await this.databaseClient.getWorkWithVoiceActors(id);

    return { media: processedMedia, voice_actors: voiceActors };
  }
}
