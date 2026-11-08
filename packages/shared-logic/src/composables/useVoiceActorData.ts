export async function fetchVoiceActorData(
  id: string | number,
  lang?: string,
): Promise<VoiceActorDataPayload | null> {
  const voiceActorResponse = await $fetch<VoiceActorDataPayload>(
    `/api/voice-actor/${id}`,
    lang ? { query: { lang } } : undefined,
  );

  if (!voiceActorResponse || !voiceActorResponse.voiceActor) {
    throw new Error("Voice actor response is missing the voice actor record");
  }

  return {
    voiceActor: voiceActorResponse.voiceActor,
    enhancedWorks: voiceActorResponse.enhancedWorks || [],
    medias: voiceActorResponse.medias || [],
    potentialWikipediaUrl: voiceActorResponse.potentialWikipediaUrl || null,
    profilePicture: voiceActorResponse.voiceActor.profile_picture || null,
    backdropPath: voiceActorResponse.backdropPath || null,
  };
}

import { ref, shallowRef, computed, watch, unref, type MaybeRef } from "vue";
import type { MovieModel, SerieModel, PersonData, Actor, Tables } from "../types";

type VoiceActorCastMember = {
  id: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
};

type VoiceActorMedia = (MovieModel | SerieModel) & {
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  credits?: { cast?: VoiceActorCastMember[] };
};

/** Work row with the dubbing project (and its studio) nested, as returned by the voice actor route. */
type VoiceActorWork = Pick<
  Tables<"work">,
  | "id"
  | "actor_id"
  | "highlight"
  | "performance"
  | "source_id"
  | "status"
  | "suggestions"
  | "voice_actor_id"
> & {
  dubbing_projects?: Pick<Tables<"dubbing_projects">, "content_id" | "content_type"> & {
    studios?: Pick<Tables<"studios">, "id" | "name" | "logo_url"> | null;
  };
};

export type VoiceActorResponse = {
  voiceActor: Pick<
    Tables<"voice_actors">,
    | "id"
    | "firstname"
    | "lastname"
    | "bio"
    | "nationality"
    | "date_of_birth"
    | "awards"
    | "years_active"
    | "profile_picture"
    | "voice_actor_name"
  > & {
    // Narrowed from the database `Json` column; the route returns string maps only.
    social_media_links: Record<string, string> | null;
    user_voice_actor_links?: { id: string }[];
    work: VoiceActorWork[];
  };
  enhancedWorks?: EnhancedWorkItem[];
  medias: VoiceActorMedia[];
  potentialWikipediaUrl?: string | null;
};

export type EnhancedWorkItem = {
  media: VoiceActorMedia;
  work: VoiceActorWork;
  data: {
    character: string | undefined;
    actor: PersonData<Actor>;
  };
  sortDate: string;
  searchText?: string;
};

function actorToPersonData(actor: {
  id: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
}): PersonData<Actor> {
  return {
    id: actor.id,
    name: actor.name,
    character: actor.character,
    profile_picture: actor.profile_path || undefined,
  };
}

export type VoiceActorDataPayload = {
  voiceActor?: VoiceActorResponse["voiceActor"];
  enhancedWorks?: EnhancedWorkItem[];
  medias: VoiceActorResponse["medias"];
  potentialWikipediaUrl: string | null;
  profilePicture?: string | null;
  backdropPath?: string | null;
};

export function useVoiceActorData(
  initialData?: MaybeRef<VoiceActorDataPayload | null | undefined>,
) {
  const initial = unref(initialData);
  const voiceActor = shallowRef<VoiceActorResponse["voiceActor"] | undefined>(initial?.voiceActor);
  const enhancedWorksRef = shallowRef<EnhancedWorkItem[]>(initial?.enhancedWorks || []);
  const medias = shallowRef<VoiceActorResponse["medias"]>(initial?.medias || []);
  const profilePicture = ref<string | null | undefined>(initial?.profilePicture);
  const backdropPath = ref<string | null | undefined>(initial?.backdropPath);
  const loading = ref<boolean>(!initial);
  const searchQuery = ref("");
  const potentialWikipediaUrl = ref<string | null>(initial?.potentialWikipediaUrl || null);

  watch(
    () => unref(initialData),
    (payload) => {
      if (payload) {
        voiceActor.value = payload.voiceActor;
        if (payload.enhancedWorks && payload.enhancedWorks.length > 0) {
          enhancedWorksRef.value = payload.enhancedWorks;
        }
        medias.value = payload.medias;
        potentialWikipediaUrl.value = payload.potentialWikipediaUrl;
        profilePicture.value = payload.profilePicture;
        backdropPath.value = payload.backdropPath;
        loading.value = false;
      }
    },
    { immediate: true },
  );

  const loadVoiceActorData = async (id: string | number, lang?: string) => {
    loading.value = true;

    try {
      const payload = await fetchVoiceActorData(id, lang);

      if (!payload) return;

      voiceActor.value = payload.voiceActor;
      if (payload.enhancedWorks && payload.enhancedWorks.length > 0) {
        enhancedWorksRef.value = payload.enhancedWorks;
      }
      medias.value = payload.medias;
      potentialWikipediaUrl.value = payload.potentialWikipediaUrl;
      profilePicture.value = payload.profilePicture;
      backdropPath.value = payload.backdropPath;
    } catch (error) {
      console.error("Error fetching voice actor:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const baseEnhancedWork = computed<EnhancedWorkItem[]>(() => {
    if (enhancedWorksRef.value && enhancedWorksRef.value.length > 0) {
      return enhancedWorksRef.value;
    }

    if (!voiceActor.value?.work) {
      return [];
    }

    const mediaMap = new Map<number, VoiceActorMedia>();
    for (const m of medias.value) {
      if (m && m.id) mediaMap.set(m.id, m);
    }

    const result = voiceActor.value.work
      .map((work) => {
        const contentId = work.dubbing_projects?.content_id;
        if (!contentId) return null;

        const media = mediaMap.get(contentId);
        if (!media) return null;

        const actor = media.credits?.cast?.find((cast) => cast.id === work.actor_id);

        if (!actor) return null;

        const character = actor.character;
        const data = {
          character,
          actor: actorToPersonData(actor),
        };

        const sortDate = media.release_date || media.first_air_date || "9999-12-31";

        const titleStr = media.title || media.name || "";
        const searchText =
          `${titleStr} ${character || ""} ${actor.name || ""} ${work.performance || ""}`.toLowerCase();

        return {
          media,
          work,
          data,
          sortDate,
          searchText,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return result;
  });

  const enhancedWork = computed(() => {
    if (!baseEnhancedWork.value) return [];
    return [...baseEnhancedWork.value].sort((a, b) => {
      if (!a || !b) return 0;
      return a.sortDate > b.sortDate ? -1 : 1;
    });
  });

  const filteredEnhancedWork = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return enhancedWork.value;

    return enhancedWork.value.filter((item) => {
      if (item.searchText) {
        return item.searchText.includes(query);
      }

      const title = (item.media.title || item.media.name || "").toLowerCase();
      const character = (item.data.character || "").toLowerCase();
      const actorName = (item.data.actor?.name || "").toLowerCase();
      const performance = (item.work.performance || "").toLowerCase();

      return (
        title.includes(query) ||
        character.includes(query) ||
        actorName.includes(query) ||
        performance.includes(query)
      );
    });
  });

  const isLinked = computed(() => {
    return (voiceActor.value?.user_voice_actor_links?.length ?? 0) > 0;
  });

  return {
    voiceActor,
    enhancedWorks: enhancedWorksRef,
    medias,
    profilePicture,
    backdropPath,
    loading,
    searchQuery,
    potentialWikipediaUrl,
    isLinked,
    baseEnhancedWork,
    enhancedWork,
    filteredEnhancedWork,
    loadVoiceActorData,
  };
}
