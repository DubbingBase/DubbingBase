import { ref } from "vue";
import type { Tables } from "../types";

export type Studio = Omit<Tables<"studios">, "social_media_links">;

export type StudioDubbedProject = Pick<
  Tables<"dubbing_projects">,
  "id" | "content_type" | "content_id" | "language"
> & {
  media: {
    title?: string | null;
    name?: string | null;
    poster_path?: string | null;
  } | null;
};

export type StudioVoiceActor = Pick<
  Tables<"voice_actors">,
  "id" | "firstname" | "lastname" | "profile_picture"
>;

export type StudioDetailsResponse = {
  studio: Studio;
  dubbedProjects: StudioDubbedProject[];
  voiceActorsRoster: StudioVoiceActor[];
};

export async function fetchStudioDetails(
  studioId: string | number,
  projection?: "studio-page",
): Promise<StudioDetailsResponse | null> {
  try {
    const data = await $fetch<StudioDetailsResponse>("/api/get-studio-details", {
      query: { studioId, ...(projection ? { projection } : {}) },
    });
    return data;
  } catch (e) {
    console.error("Error fetching studio details:", e);
    throw e;
  }
}

export async function fetchStudiosData(): Promise<Studio[]> {
  try {
    const data = await $fetch<Studio[]>("/api/get-studio-details");
    return data || [];
  } catch (e) {
    console.error("Error fetching studios:", e);
    throw e;
  }
}

export function useStudioData(
  initialStudios?: Studio[],
  initialStudioDetails?: StudioDetailsResponse | null,
) {
  const studios = ref<Studio[]>(initialStudios || []);
  const studio = ref<Studio | null>(initialStudioDetails?.studio || null);
  const dubbedProjects = ref<StudioDubbedProject[]>(initialStudioDetails?.dubbedProjects || []);
  const voiceActorsRoster = ref<StudioVoiceActor[]>(initialStudioDetails?.voiceActorsRoster || []);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchStudios = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<Studio[]>("/api/get-studio-details");
      studios.value = data || [];
    } catch (err: unknown) {
      console.error("Error fetching studios:", err);
      error.value = err instanceof Error ? err.message : "Failed to load studios";
    } finally {
      loading.value = false;
    }
  };

  const loadStudioDetails = async (id: string | number) => {
    loading.value = true;
    error.value = null;
    try {
      const payload = await fetchStudioDetails(id);
      if (payload) {
        studio.value = payload.studio;
        dubbedProjects.value = payload.dubbedProjects;
        voiceActorsRoster.value = payload.voiceActorsRoster;
      }
    } catch (err: unknown) {
      console.error("Error loading studio details:", err);
      error.value = err instanceof Error ? err.message : "Failed to load studio details";
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
