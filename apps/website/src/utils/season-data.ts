import type { MediaDetailMedia } from "@app/shared-logic";
import type { CastActorReference, CastWorkReference } from "./media-cast";
import type { CharacterProfilePicture } from "./show-character-pictures";

export interface SeasonPageDubbingProject {
  id: number;
  language?: string | null;
  studio_data?: { id: number; name: string; logo_url?: string | null } | null;
  has_voice_actor: boolean;
  voice_actor_count: number;
  work_count: number;
}

interface SeasonPageSeason {
  id: number;
  name?: string;
  air_date?: string | null;
  episode_count?: number | null;
  vote_average?: number | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  episodes?: Array<{
    episode_number: number;
    name?: string | null;
    air_date?: string | null;
    still_path?: string | null;
    vote_average?: number;
  }>;
}

interface SeasonPageDataResponse {
  season: SeasonPageSeason;
  serie: {
    id: number;
    name: string;
    backdrop_path: string | null;
    poster_path: string | null;
  } | null;
  dubbingProjects: SeasonPageDubbingProject[];
  characterProfilePictures: CharacterProfilePicture[];
  votes: Record<number, unknown>;
}

export interface EpisodePageDubbingProject {
  id: number;
  language?: string | null;
  studio_data?: { id: number; name: string; logo_url?: string | null } | null;
  workCount: number;
  voiceActorCount: number;
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
  activeProjectId: number | null;
  activeProjectWorks: CastWorkReference[];
  characterProfilePictures: CharacterProfilePicture[];
  votes: Record<number, unknown>;
}

export interface EpisodePageProjectWorksResponse {
  projectId: number;
  works: CastWorkReference[];
  voiceActors: EpisodePageVoiceActor[];
}

export async function fetchSeasonPageData(
  showId: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<SeasonPageDataResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch<SeasonPageDataResponse>("/api/season", {
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
  projectId?: number,
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
      dub: projectId,
    },
  });
}

export async function fetchEpisodeProjectWorks(
  showId: string | number,
  projectId: number,
  locale?: string,
): Promise<EpisodePageProjectWorksResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch<EpisodePageProjectWorksResponse>("/api/episode", {
    headers,
    timeout: 20_000,
    query: { id: showId, projection: "episode-project", project_id: projectId },
  });
}
