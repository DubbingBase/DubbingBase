// Mistral AI Types (used by extract-credits functions)

export interface MistralMovieExtractOutput {
  voice_actors: MistralMovieExtractItemOutput[];
}

export interface MistralMovieExtractItemOutput {
  tmdb_person_id: number;
  character_name: string;
  original_actor_name: string;
  voice_actor_name: string;
  confidence: number;
}

export interface MistralVoiceActorExtractOutput {
  voice_actor_info: MistralVoiceActorExtractItemOutput;
}

export interface MistralVoiceActorExtractItemOutput {
  firstname: string;
  lastname: string;
  date_of_birth: string | null;
  nationality: string | null;
  bio: string | null;
  awards: string | null;
  years_active: string | null;
  social_media_links: Record<string, string> | null;
  wikidata_id: string | null;
  profile_picture: string | null;
}
