import type { fetchSeasonData as fetchSharedSeasonData } from "@app/shared-logic";
import type { MediaDetailMedia } from "@app/shared-logic";
import type { CastActorReference, CastWorkReference } from "./media-cast";
import type { CharacterProfilePicture } from "./show-character-pictures";

type SeasonDataResponse = Awaited<ReturnType<typeof fetchSharedSeasonData>>;

export interface EpisodePageDubbingProject {
  id: number;
  language?: string | null;
  studio_data?: { id: number; name: string; logo_url?: string | null } | null;
  works?: CastWorkReference[];
}

export interface EpisodePageVoiceActor {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  profile_picture?: string | null;
}

export interface EpisodePageDataResponse {
  episode: MediaDetailMedia & {
    episode_number: number;
    air_date?: string | null;
    still_path?: string | null;
    show_original_language?: string | null;
  };
  aggregateCredits?: { cast?: CastActorReference[] };
  dubbingProjects: EpisodePageDubbingProject[];
  voiceActors: EpisodePageVoiceActor[];
  characterProfilePictures: CharacterProfilePicture[];
  votes: Record<number, unknown>;
}

export async function fetchSeasonPageData(
  showId: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<SeasonDataResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch("/api/season", {
    headers,
    timeout: 20_000,
    query: {
      id: showId,
      season_number: seasonNumber,
      projection: "media-page",
    },
  });
}

export async function fetchEpisodePageData(
  showId: string | number,
  seasonNumber: string | number,
  episodeNumber: string | number,
  locale?: string,
): Promise<EpisodePageDataResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch<EpisodePageDataResponse>("/api/episode", {
    headers,
    timeout: 20_000,
    query: {
      id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      projection: "episode-page",
    },
  });
}
