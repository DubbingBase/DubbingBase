import { useSupabaseAdmin } from "../db/client";
import { findOrCreateDubbingProject } from "../db/dubbing-project";

export async function upsertVoiceActor(firstName: string, lastName: string) {
  const supabase = useSupabaseAdmin();
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();

  // Try exact match first
  const { data: existingExact, error: selectExactError } = await supabase
    .from("voice_actors")
    .select("id")
    .eq("firstname", trimmedFirstName)
    .eq("lastname", trimmedLastName)
    .maybeSingle();

  if (selectExactError) throw selectExactError;
  if (existingExact) {
    return { data: existingExact, inserted: false };
  }

  // Try case-insensitive match
  const { data: existingIlike, error: selectIlikeError } = await supabase
    .from("voice_actors")
    .select("id")
    .ilike("firstname", trimmedFirstName)
    .ilike("lastname", trimmedLastName)
    .maybeSingle();

  if (selectIlikeError) throw selectIlikeError;
  if (existingIlike) {
    return { data: existingIlike, inserted: false };
  }

  // Insert new voice actor
  const { data, error } = await (supabase.from("voice_actors") as any)
    .insert({
      firstname: trimmedFirstName,
      lastname: trimmedLastName,
    })
    .select()
    .single();

  if (error) throw error;
  return { data, inserted: true };
}

export async function upsertActor(
  id: number,
  name: string,
  profile_path?: string,
) {
  const supabase = useSupabaseAdmin();
  const trimmedName = name.trim();

  const { data, error } = await (supabase as any)
    .from("actors")
    .upsert({
      id,
      name: trimmedName,
      profile_path,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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

  const { data, error } = await (supabase.from("studios") as any)
    .insert({
      name: trimmedName,
      logo_url,
    })
    .select()
    .single();

  if (error) throw error;
  return { data, inserted: true };
}

export async function upsertWork(
  voiceActorId: number,
  contentId: number,
  actorId: number | null,
  contentType: string,
  performance?: string,
  characterId?: number | null,
  characterName?: string | null,
) {
  const supabase = useSupabaseAdmin();
  const dubbing_project_id = await findOrCreateDubbingProject(
    contentId,
    contentType,
  );

  let query = supabase
    .from("work")
    .select("id")
    .eq("dubbing_project_id", dubbing_project_id)
    .eq("voice_actor_id", voiceActorId);

  if (actorId) {
    query = query.eq("actor_id", actorId);
  } else {
    query = query.is("actor_id", null);
  }

  if (characterId) {
    query = query.eq("character_id", characterId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { data, error } = await (supabase.from("work") as any)
      .update({
        performance: performance || null,
        ...(characterName ? { character_name: characterName } : {}),
      })
      .eq("id", (existing as any).id)
      .select();
    if (error) throw error;
    return data || [];
  } else {
    const { data, error } = await (supabase.from("work") as any)
      .insert({
        voice_actor_id: voiceActorId,
        actor_id: actorId || null,
        performance: performance || null,
        dubbing_project_id,
        character_id: characterId || null,
        character_name: characterName || null,
      })
      .select();
    if (error) throw error;
    return data || [];
  }
}

export async function insertVoiceActorAndWork(
  firstName: string,
  lastName: string,
  contentId: number,
  actorId: number,
  contentType: string,
  performance?: string,
  characterId?: number | null,
  characterName?: string | null,
) {
  const voiceActorResult = await upsertVoiceActor(firstName, lastName);
  const workResult = await upsertWork(
    (voiceActorResult.data as any).id,
    contentId,
    actorId,
    contentType,
    performance,
    characterId,
    characterName,
  );

  return { voiceActorResult, workResult };
}
