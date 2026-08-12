// Voice Actor Types (used by actor/voice-actor functions)

export interface VoiceActorDetails {
  id: number;
  bio: string | null;
  awards: string | null;
  lastname: string;
  firstname: string;
  nationality: string | null;
  years_active: string | null;
  date_of_birth: string | null;
  social_media_links: Record<string, string> | null;
  profile_picture: string | null;
  tmdb_id: number | null;
  wikidata_id: string | null;
}

export interface WorkAndVoiceActor {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number;
  highlight: boolean;
  suggestions: string | null;
  status: string;
  source_id: number | null;
  voiceActorDetails: VoiceActorDetails;
  performance: string | null;
}

export interface Actor {
  id: number;
  firstname: string;
  lastname: string;
  tmdb_id: number | null;
  profile_picture: string | null;
  voiceActorDetails: VoiceActorDetails | null;
}

export interface ActorCredits {
  cast: Array<{
    id: number;
    title: string | null;
    name: string | null;
    character: string;
    poster_path: string | null;
    media_type: "movie" | "tv";
    release_date: string | null;
    first_air_date: string | null;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
    department: string;
    credit_id: string;
  }>;
}
