import { ref, computed, watch } from "vue";
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
      dubbing_projects?: {
        language: string;
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
  id: string | number,
): Promise<ActorDataPayload | null> {
  try {
    const response = await $fetch<ActorResponse>(`/api/actor/${id}`);

    if (!response || !response.actor) {
      console.error("Actor response is null");
      return null;
    }

    return {
      actor: response.actor,
      voiceRoles: response.actor.voice_roles || [],
    };
  } catch (e) {
    console.error("fetchActorData error:", e);
    return null;
  }
}

export function useActorData(initialData?: ActorDataPayload | null) {
  const actor = ref<ActorResponse["actor"] | undefined>(initialData?.actor);
  const voiceRoles = ref<NonNullable<ActorResponse["actor"]["voice_roles"]>>(
    initialData?.voiceRoles || [],
  );
  const loading = ref<boolean>(!initialData);
  const searchQuery = ref("");

  const availableLanguages = computed(() => {
    if (!voiceRoles.value) return [];
    const langs = new Set<string>();
    for (const role of voiceRoles.value) {
      if (role.dubbing_projects?.language) {
        langs.add(role.dubbing_projects.language);
      }
    }
    return Array.from(langs).sort();
  });

  const selectedLanguage = ref<string>("");

  watch(
    availableLanguages,
    (langs) => {
      if (langs.length > 0 && !selectedLanguage.value) {
        selectedLanguage.value =
          (langs.includes("fr-FR") ? "fr-FR" : langs[0]) || "";
      }
    },
    { immediate: true },
  );

  const loadActorData = async (id: string | number) => {
    loading.value = true;

    try {
      const payload = await fetchActorData(id);

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

  const enhancedFilmography = computed(() => {
    if (!actor.value?.credits?.cast) return [];

    const query = searchQuery.value.toLowerCase();
    const cast = actor.value.credits.cast;

    const rolesByMedia = new Map();
    for (const role of voiceRoles.value) {
      if (!role.mediaDetails?.id) continue;
      if (!rolesByMedia.has(role.mediaDetails.id)) {
        rolesByMedia.set(role.mediaDetails.id, []);
      }
      rolesByMedia.get(role.mediaDetails.id).push(role);
    }

    let items = cast;
    if (query) {
      items = cast.filter((item) => {
        const title = (item.title || item.name || "").toLowerCase();
        const character = (item.character || "").toLowerCase();
        return title.includes(query) || character.includes(query);
      });
    }

    return items.map((item) => {
      const mediaRoles = rolesByMedia.get(item.id) || [];
      const languageRoles = selectedLanguage.value
        ? mediaRoles.filter(
            (r: any) => r.dubbing_projects?.language === selectedLanguage.value,
          )
        : mediaRoles;

      const voiceActors = languageRoles.flatMap(
        (r: any) => r.voice_actors || [],
      );

      return {
        ...item,
        dubbing_roles: languageRoles,
        voice_actors: voiceActors,
      };
    });
  });

  const uniqueVoiceActorsByLanguage = computed(() => {
    if (!voiceRoles.value || !selectedLanguage.value) return [];

    const vaMap = new Map();
    for (const role of voiceRoles.value) {
      if (role.dubbing_projects?.language !== selectedLanguage.value) continue;

      if (role.voice_actors && role.voice_actors.length > 0) {
        for (const va of role.voice_actors) {
          if (!vaMap.has(va.id)) {
            vaMap.set(va.id, {
              ...va,
              rolesCount: 1,
              highlight: role.highlight,
            });
          } else {
            const existing = vaMap.get(va.id);
            existing.rolesCount++;
            if (role.highlight) existing.highlight = true;
          }
        }
      }
    }

    return Array.from(vaMap.values()).sort(
      (a, b) => b.rolesCount - a.rolesCount,
    );
  });

  const filteredUniqueVoiceActorsByLanguage = computed(() => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return uniqueVoiceActorsByLanguage.value;

    return uniqueVoiceActorsByLanguage.value.filter((va) => {
      const fullname =
        `${va.firstname || ""} ${va.lastname || ""}`.toLowerCase();
      return fullname.includes(query);
    });
  });

  return {
    actor,
    voiceRoles,
    loading,
    searchQuery,
    filteredCredits,
    enhancedFilmography,
    availableLanguages,
    selectedLanguage,
    uniqueVoiceActorsByLanguage,
    filteredUniqueVoiceActorsByLanguage,
    loadActorData,
  };
}
