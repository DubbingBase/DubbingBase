import { reactive } from "vue";

export interface AdminLookupOption {
  id: number;
  name: string;
}

const STUDIO_LIMIT = 10;
const VOICE_ACTOR_LIMIT = 15;

export const formatVoiceActorName = (
  voiceActor: { firstname: string | null; lastname: string | null } | null | undefined,
): string => `${voiceActor?.firstname || ""} ${voiceActor?.lastname || ""}`.trim();

/**
 * Studio and voice-actor lookups for admin editors. Search functions return their results
 * instead of writing shared option lists, so each autocomplete owns its own result state.
 * Known labels are cached by id, independently of any current search result.
 */
export function useAdminLookups() {
  const supabase = useSupabaseClient();
  const studioLabels = reactive(new Map<number, string>());
  const voiceActorLabels = reactive(new Map<number, string>());

  const rememberStudio = (id: number | null | undefined, name: string | null | undefined) => {
    if (id == null || !name) return;
    studioLabels.set(id, name);
  };

  const rememberVoiceActor = (id: number | null | undefined, name: string | null | undefined) => {
    if (id == null || !name) return;
    voiceActorLabels.set(id, name);
  };

  const studioLabel = (id: number | null | undefined): string => {
    if (id == null) return "";
    return studioLabels.get(id) || `Studio #${id}`;
  };

  const voiceActorLabel = (id: number | null | undefined): string => {
    if (id == null) return "";
    return voiceActorLabels.get(id) || `VA #${id}`;
  };

  const searchStudios = async (query: string): Promise<AdminLookupOption[]> => {
    let request = supabase.from("studios").select("id, name").limit(STUDIO_LIMIT);
    if (query) request = request.ilike("name", `%${query}%`);
    const { data, error } = await request;
    if (error) throw error;
    const options = (data || []).map((studio) => ({
      id: studio.id,
      name: studio.name,
    }));
    options.forEach((option) => rememberStudio(option.id, option.name));
    return options;
  };

  const searchVoiceActors = async (query: string): Promise<AdminLookupOption[]> => {
    let request = supabase
      .from("voice_actors")
      .select("id, firstname, lastname")
      .limit(VOICE_ACTOR_LIMIT);
    if (query) request = request.or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`);
    const { data, error } = await request;
    if (error) throw error;
    const options = (data || []).map((voiceActor) => ({
      id: voiceActor.id,
      name: formatVoiceActorName(voiceActor),
    }));
    options.forEach((option) => rememberVoiceActor(option.id, option.name));
    return options;
  };

  const createStudio = async (name: string): Promise<AdminLookupOption> => {
    const { data, error } = await supabase
      .from("studios")
      .insert({ name })
      .select("id, name")
      .single();
    if (error) throw error;
    rememberStudio(data.id, data.name);
    return { id: data.id, name: data.name };
  };

  return {
    rememberStudio,
    rememberVoiceActor,
    studioLabel,
    voiceActorLabel,
    searchStudios,
    searchVoiceActors,
    createStudio,
  };
}

export type AdminLookups = ReturnType<typeof useAdminLookups>;
