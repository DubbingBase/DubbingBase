import type { Json } from "@app/supabase";
import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

type DuplicateVoiceActor = {
  id: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  tmdb_id: number | null;
  wikidata_id: string | null;
  profile_picture: string | null;
};

function isJsonArray(value: Json | null | undefined): value is Json[] {
  return Array.isArray(value);
}

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDuplicateVoiceActor(value: Json): value is DuplicateVoiceActor {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "number" &&
    typeof value.firstname === "string" &&
    typeof value.lastname === "string" &&
    (typeof value.bio === "string" || value.bio === null) &&
    (typeof value.nationality === "string" || value.nationality === null) &&
    (typeof value.date_of_birth === "string" || value.date_of_birth === null) &&
    (typeof value.tmdb_id === "number" || value.tmdb_id === null) &&
    (typeof value.wikidata_id === "string" || value.wikidata_id === null) &&
    (typeof value.profile_picture === "string" || value.profile_picture === null)
  );
}

function projectDuplicateVoiceActor(value: Json): DuplicateVoiceActor {
  if (!isDuplicateVoiceActor(value)) {
    throw createError({ statusCode: 500, message: "Invalid duplicate voice actor" });
  }
  return {
    id: value.id,
    firstname: value.firstname,
    lastname: value.lastname,
    bio: value.bio,
    nationality: value.nationality,
    date_of_birth: value.date_of_birth,
    tmdb_id: value.tmdb_id,
    wikidata_id: value.wikidata_id,
    profile_picture: buildSupabaseImageUrl(value.profile_picture),
  };
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("find_duplicate_voice_actors_rpc");

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }
  if (!isJsonArray(data)) {
    throw createError({ statusCode: 500, message: "Invalid duplicate voice actor response" });
  }

  return data.map((value) => {
    if (!isRecord(value) || !isJsonArray(value.actors)) {
      throw createError({ statusCode: 500, message: "Invalid duplicate voice actor group" });
    }
    return { actors: value.actors.map(projectDuplicateVoiceActor) };
  });
});
