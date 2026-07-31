import { ref, computed } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovieModel, SerieModel } from "../types";

export type ActorResponse = {
  actor: {
    id: number;
    name: string;
    biography: string;
    birthday: string | null;
    deathday: string | null;
    place_of_birth: string | null;
    profile_path: string | null;
    known_for_department: string;
    credits: {
      cast: Array<{
        id: number;
        title?: string;
        name?: string;
        character: string;
        poster_path: string | null;
        release_date?: string;
        first_air_date?: string;
        media_type: "movie" | "tv";
      }>;
    };
    voice_roles: Array<{
      id: number;
      performance: string | null;
      highlight: boolean;
      voice_actors: Array<{
        id: number;
        firstname: string;
        lastname: string;
        profile_picture: string | null;
      }>;
      mediaDetails: {
        id: number;
        title: string;
        original_title: string;
        poster_path: string | null;
        release_date: string;
        media_type: string;
        overview: string;
      } | null;
    }>;
  };
  voiceActors: Array<any>;
};

export type ActorDataPayload = {
  actor?: ActorResponse["actor"];
  voiceRoles: NonNullable<ActorResponse["actor"]["voice_roles"]>;
};

export async function fetchActorData(
  supabase: SupabaseClient,
  id: string | number,
): Promise<ActorDataPayload | null> {
  const responseRaw = await supabase.functions.invoke("actor", {
    body: { id },
  });

  const response = (await responseRaw.data) as ActorResponse;

  if (!response || !response.actor) {
    console.error("Actor response is null");
    return null;
  }

  return {
    actor: response.actor,
    voiceRoles: response.actor.voice_roles || [],
  };
}

export function useActorData(
  supabase: SupabaseClient,
  initialData?: ActorDataPayload | null,
) {
  const actor = ref<ActorResponse["actor"] | undefined>(initialData?.actor);
  const voiceRoles = ref<NonNullable<ActorResponse["actor"]["voice_roles"]>>(
    initialData?.voiceRoles || [],
  );
  const loading = ref<boolean>(!initialData);
  const searchQuery = ref("");

  const loadActorData = async (id: string | number) => {
    loading.value = true;

    try {
      const payload = await fetchActorData(supabase, id);

      if (!payload) return;

      actor.value = payload.actor;
      voiceRoles.value = payload.voiceRoles;
    } catch (error) {
      console.error("Error fetching actor:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const filteredCredits = computed(() => {
    if (!actor.value?.credits?.cast) return [];
    
    const query = searchQuery.value.toLowerCase();
    const cast = actor.value.credits.cast;
    
    if (!query) return cast;

    return cast.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase();
      const character = (item.character || "").toLowerCase();

      return title.includes(query) || character.includes(query);
    });
  });

  // Extract unique voice actors who dubbed this actor
  const uniqueFrenchVoiceActors = computed(() => {
    if (!voiceRoles.value) return [];
    
    const vaMap = new Map();
    for (const role of voiceRoles.value) {
      if (role.voice_actors && role.voice_actors.length > 0) {
        for (const va of role.voice_actors) {
          if (!vaMap.has(va.id)) {
            vaMap.set(va.id, {
              ...va,
              rolesCount: 1,
              highlight: role.highlight
            });
          } else {
            const existing = vaMap.get(va.id);
            existing.rolesCount++;
            if (role.highlight) existing.highlight = true;
          }
        }
      }
    }
    
    return Array.from(vaMap.values()).sort((a, b) => b.rolesCount - a.rolesCount);
  });

  const filteredUniqueFrenchVoiceActors = computed(() => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return uniqueFrenchVoiceActors.value;
    
    return uniqueFrenchVoiceActors.value.filter((va) => {
      const fullname = `${va.firstname || ""} ${va.lastname || ""}`.toLowerCase();
      return fullname.includes(query);
    });
  });

  return {
    actor,
    voiceRoles,
    loading,
    searchQuery,
    filteredCredits,
    uniqueFrenchVoiceActors,
    filteredUniqueFrenchVoiceActors,
    loadActorData,
  };
}
