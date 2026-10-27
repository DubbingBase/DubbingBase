import type { VoiceActorProfile } from "~/utils/voice-actor-profile-save";

export function useVoiceActorProfileRecord() {
  const supabase = useSupabaseClient();

  async function getProfile(id: number): Promise<VoiceActorProfile> {
    const { data, error } = await supabase.from("voice_actors").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  return { getProfile };
}
