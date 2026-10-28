import { ref, computed, watch, unref, type MaybeRef } from "vue";

type ActorVoiceActor = {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
};

type ActorVoiceRole = {
  id: number;
  performance: string | null;
  voice_actors: ActorVoiceActor[];
  mediaDetails?: {
    id: number;
    title?: string;
    original_title?: string;
    poster_path?: string | null;
    release_date?: string;
    media_type?: string;
    overview?: string;
  } | null;
  dubbing_projects?: {
    language: string;
    content_id?: number;
  } | null;
};

export type ActorResponse = {
  filmographyCount?: number;
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
    voice_roles: ActorVoiceRole[];
  };
  voiceActors?: ActorVoiceRole[];
};

export type ActorDataPayload = {
  actor?: ActorResponse["actor"];
  voiceRoles: NonNullable<ActorResponse["actor"]["voice_roles"]>;
  filmographyCount?: number;
};

export async function fetchActorData(
  id: string | number,
  options: { projection?: "actor-page"; filmographyPage?: number } = {},
): Promise<ActorDataPayload | null> {
  try {
    const query: Record<string, string | number> = {};
    if (options.projection) query.projection = options.projection;
    if (options.filmographyPage !== undefined) query.filmographyPage = options.filmographyPage;

    const response = await $fetch<ActorResponse>(`/api/actor/${id}`, {
      ...(Object.keys(query).length > 0 ? { query } : {}),
    });

    if (!response || !response.actor) {
      console.error("Actor response is null");
      return null;
    }

    return {
      actor: response.actor,
      voiceRoles: response.actor.voice_roles || [],
      ...(response.filmographyCount !== undefined
        ? { filmographyCount: response.filmographyCount }
        : {}),
    };
  } catch (e) {
    console.error("fetchActorData error:", e);
    return null;
  }
}

export function useActorData(
  initialData?: MaybeRef<ActorDataPayload | null | undefined>,
  options: {
    filmographyPagination?: MaybeRef<{ page: number; pageSize: number }>;
  } = {},
) {
  const initial = unref(initialData);
  const actor = ref<ActorResponse["actor"] | undefined>(initial?.actor);
  const voiceRoles = ref<NonNullable<ActorResponse["actor"]["voice_roles"]>>(
    initial?.voiceRoles || [],
  );
  const loading = ref<boolean>(!initial);
  const filmographyCount = ref(
    initial?.filmographyCount ?? initial?.actor?.credits.cast.length ?? 0,
  );
  const filmographyComplete = ref(
    Boolean(initial?.actor && initial.filmographyCount === undefined),
  );
  const searchQuery = ref("");

  const applyPayload = (payload: ActorDataPayload) => {
    actor.value = payload.actor;
    voiceRoles.value = payload.voiceRoles || [];
    filmographyCount.value = payload.filmographyCount ?? payload.actor?.credits.cast.length ?? 0;
    filmographyComplete.value = payload.filmographyCount === undefined;
    loading.value = false;
  };

  watch(
    () => unref(initialData),
    (payload) => {
      if (payload) applyPayload(payload);
    },
    { immediate: true },
  );

  let fullFilmographyRequest: Promise<boolean> | undefined;

  const loadActorData = async (id: string | number): Promise<boolean> => {
    if (filmographyComplete.value) return true;
    if (fullFilmographyRequest) return fullFilmographyRequest;

    const request = (async () => {
      if (!actor.value) loading.value = true;

      try {
        const payload = await fetchActorData(id, { projection: "actor-page" });
        if (!payload) return false;
        applyPayload(payload);
        return true;
      } catch (error) {
        console.error("Error fetching actor:", error);
        return false;
      } finally {
        loading.value = false;
        fullFilmographyRequest = undefined;
      }
    })();
    fullFilmographyRequest = request;
    return request;
  };

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
        selectedLanguage.value = (langs.includes("fr-FR") ? "fr-FR" : langs[0]) || "";
      }
    },
    { immediate: true },
  );

  const filteredCredits = computed(() => {
    if (!actor.value?.credits?.cast) return [];

    const query = searchQuery.value.trim().toLowerCase();
    const cast = actor.value.credits.cast;

    if (!query) return cast;

    return cast.filter((item) => {
      const title = (item.title || "").trim().toLowerCase();
      const name = (item.name || "").trim().toLowerCase();
      const character = (item.character || "").toLowerCase();

      return title.includes(query) || name.includes(query) || character.includes(query);
    });
  });

  const roleIndexes = computed(() => {
    const rolesByMedia = new Map<number, ActorVoiceRole[]>();
    const voiceActorsById = new Map<number, ActorVoiceActor & { rolesCount: number }>();
    const language = selectedLanguage.value;

    for (const role of voiceRoles.value) {
      const mediaId = role.dubbing_projects?.content_id ?? role.mediaDetails?.id;
      if (mediaId) {
        const mediaRoles = rolesByMedia.get(mediaId);
        if (mediaRoles) mediaRoles.push(role);
        else rolesByMedia.set(mediaId, [role]);
      }

      if (!language || role.dubbing_projects?.language !== language) {
        continue;
      }

      for (const voiceActor of role.voice_actors || []) {
        const existing = voiceActorsById.get(voiceActor.id);
        if (existing) existing.rolesCount++;
        else voiceActorsById.set(voiceActor.id, { ...voiceActor, rolesCount: 1 });
      }
    }

    return {
      rolesByMedia,
      uniqueVoiceActors: Array.from(voiceActorsById.values()).sort(
        (a, b) => b.rolesCount - a.rolesCount,
      ),
    };
  });

  const enhancedFilmography = computed(() => {
    if (!actor.value?.credits?.cast) return [];

    let items = filteredCredits.value;
    const pagination = unref(options.filmographyPagination);
    if (pagination && filmographyComplete.value) {
      // Filter the complete collection before enriching only the visible page.
      const start = (pagination.page - 1) * pagination.pageSize;
      items = items.slice(start, start + pagination.pageSize);
    }

    return items.map((item) => {
      const mediaRoles = roleIndexes.value.rolesByMedia.get(item.id) || [];
      const languageRoles = selectedLanguage.value
        ? mediaRoles.filter((role) => role.dubbing_projects?.language === selectedLanguage.value)
        : mediaRoles;

      const voiceActors = languageRoles.flatMap((role) => role.voice_actors || []);

      return {
        ...item,
        dubbing_roles: languageRoles,
        voice_actors: voiceActors,
      };
    });
  });

  const uniqueVoiceActorsByLanguage = computed(() => roleIndexes.value.uniqueVoiceActors);

  const filteredUniqueVoiceActorsByLanguage = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return uniqueVoiceActorsByLanguage.value;

    return uniqueVoiceActorsByLanguage.value.filter((va) => {
      return [va.firstname, va.lastname].some((name) =>
        (name || "").trim().toLowerCase().includes(query),
      );
    });
  });

  return {
    actor,
    voiceRoles,
    loading,
    filmographyCount,
    filmographyComplete,
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
