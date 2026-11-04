// Shared domain types live in @app/shared-logic; this module re-exports them so
// the website and the shared package cannot drift apart.
export type {
  Actor,
  ActorCredits,
  Advertisement,
  AdvertisementResponse,
  Audiobook,
  AudiobookResponse,
  Cast,
  GameResponse,
  Genre,
  IgdbCharacter,
  IgdbCompany,
  IgdbCover,
  IgdbExternalGame,
  IgdbGame,
  IgdbGenre,
  IgdbInvolvedCompany,
  IgdbMugShot,
  IgdbPlatform,
  Movie,
  MovieResponse,
  OpenLibraryAuthor,
  Podcast,
  PodcastEpisode,
  PodcastResponse,
  Season,
  Serie,
  SerieResponse,
  SerieTrendingResponse,
  ShowResponse,
  Toy,
  ToyResponse,
  TrendingResponse,
  VoiceActorDetails,
  WithCast,
  WithExtrernalIds,
  WorkAndVoiceActor,
} from "@app/shared-logic";

export interface LlmMovieExtractOutput {
  items?: LlmMovieExtractItemOutput[];
}

export interface LlmMovieExtractItemOutput {
  actor: string;
  voiceActorName: string;
  voiceActorFirstname: string;
  performance?: string;
}

export interface LlmVoiceActorExtractOutput {
  items?: LlmVoiceActorExtractItemOutput[];
}

export interface LlmVoiceActorExtractItemOutput {
  actor: string;
  performance?: string;
  production?: string;
  year?: number;
}

export interface IgdbPopularityPrimitive {
  id: number;
  game_id: number;
  value: number;
  popularity_type: number;
  calculated_at?: string;
}
