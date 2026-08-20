import { ref } from "vue";

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
  studioId: string | number,
): Promise<StudioDetailsResponse | null> {
  try {
    const data = await $fetch<StudioDetailsResponse>(
      "/api/get-studio-details",
      {
        params: { studioId },
      },
    );
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
  const dubbedProjects = ref<any[]>(initialStudioDetails?.dubbedProjects || []);
  const voiceActorsRoster = ref<any[]>(
    initialStudioDetails?.voiceActorsRoster || [],
  );
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchStudios = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<Studio[]>("/api/get-studio-details");
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
      const payload = await fetchStudioDetails(id);
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
