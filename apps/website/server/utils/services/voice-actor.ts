import { requireDubbingLanguage } from "../dubbing-language";
import { useSupabaseAdmin } from "../db/client";
import type { DubbingLanguage } from "@app/shared-logic";
import type { Json } from "@app/supabase/types";

export interface ExtractedCredit {
  firstname: string;
  lastname: string;
  actorId: number;
  performance?: string;
  characterId?: number | null;
  characterName?: string | null;
}

export interface AppliedExtractedCredits {
  newVoiceActors: number;
  creditsAdded: number;
}

function readCount(value: unknown, key: string): number {
  if (typeof value !== "object" || value === null) return 0;
  const count = Reflect.get(value, key);
  return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
}

/** Persist all credits from an extraction in a single database transaction/RPC. */
export async function applyExtractedCredits(
  contentId: number,
  contentType: "movie" | "tv" | "video_game",
  dubbingLanguage: DubbingLanguage,
  credits: ExtractedCredit[],
): Promise<AppliedExtractedCredits> {
  requireDubbingLanguage(dubbingLanguage);
  if (credits.length === 0) return { newVoiceActors: 0, creditsAdded: 0 };

  const payload: Json = credits.map((credit) => ({
    firstname: credit.firstname,
    lastname: credit.lastname,
    actor_id: credit.actorId,
    performance: credit.performance ?? null,
    character_id: credit.characterId ?? null,
    character_name: credit.characterName ?? null,
  }));
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("apply_extracted_credits", {
    p_content_id: contentId,
    p_content_type: contentType,
    p_dubbing_language: dubbingLanguage,
    p_credits: payload,
  });

  if (error) throw error;
  return {
    newVoiceActors: readCount(data, "new_voice_actors"),
    creditsAdded: readCount(data, "credits_added"),
  };
}

export async function upsertStudio(name: string, logo_url?: string) {
  const supabase = useSupabaseAdmin();
  const trimmedName = name.trim();

  const { data: existing, error: selectError } = await supabase
    .from("studios")
    .select("id")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) {
    return { data: existing, inserted: false };
  }

  const { data, error } = await supabase
    .from("studios")
    .insert({
      name: trimmedName,
      logo_url,
    })
    .select()
    .single();

  if (error) throw error;
  return { data, inserted: true };
}
