import { ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Studio = {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  created_at: string | null;
  description: string | null;
  logo_url: string | null;
  updated_at: string | null;
  website_url: string | null;
};

export type StudioDetailsResponse = {
  studio: Studio;
  dubbedProjects: any[];
  voiceActorsRoster: any[];
};

export async function fetchStudioDetails(
  supabase: SupabaseClient,
  studioId: string | number,
): Promise<StudioDetailsResponse | null> {
  const { data, error } = await supabase.functions.invoke(
    "get-studio-details",
    {
      body: { studioId },
    },
  );

  if (error) {
    console.error("Error fetching studio details:", error);
    throw error;
  }

  return data as StudioDetailsResponse;
}

export function useStudioData(supabase: SupabaseClient) {
  const studios = ref<Studio[]>([]);
  const studio = ref<Studio | null>(null);
  const dubbedProjects = ref<any[]>([]);
  const voiceActorsRoster = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchStudios = async () => {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: fetchError } = await supabase
        .from("studios")
        .select("*")
        .order("name");

      if (fetchError) throw fetchError;
      studios.value = data || [];
    } catch (err: any) {
      console.error("Error fetching studios:", err);
      error.value = err.message || "Failed to load studios";
    } finally {
      loading.value = false;
    }
  };

  const loadStudioDetails = async (id: string | number) => {
    loading.value = true;
    error.value = null;
    try {
      const payload = await fetchStudioDetails(supabase, id);
      if (payload) {
        studio.value = payload.studio;
        dubbedProjects.value = payload.dubbedProjects;
        voiceActorsRoster.value = payload.voiceActorsRoster;
      }
    } catch (err: any) {
      console.error("Error loading studio details:", err);
      error.value = err.message || "Failed to load studio details";
    } finally {
      loading.value = false;
    }
  };

  return {
    studios,
    studio,
    dubbedProjects,
    voiceActorsRoster,
    loading,
    error,
    fetchStudios,
    loadStudioDetails,
  };
}
