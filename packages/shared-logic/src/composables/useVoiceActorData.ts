export async function fetchVoiceActorData(
  id: string | number,
): Promise<VoiceActorDataPayload | null> {
  try {
    const voiceActorResponse = await $fetch<any>(`/api/voice-actor/${id}`);

    if (!voiceActorResponse || !voiceActorResponse.voiceActor) {
      console.error("voiceActorResponse is null");
      return null;
    }

    return {
      voiceActor: voiceActorResponse.voiceActor,
      enhancedWorks: voiceActorResponse.enhancedWorks || [],
      medias: voiceActorResponse.medias || [],
      characterProfilePictures:
        voiceActorResponse.characterProfilePictures || [],
      potentialWikipediaUrl: voiceActorResponse.potentialWikipediaUrl || null,
      profilePicture: voiceActorResponse.voiceActor.profile_picture || null,
    };
  } catch (e) {
    console.error("fetchVoiceActorData error:", e);
    return null;
  }
}

import { ref, computed, watch, unref, type MaybeRef } from "vue";
import type { MovieModel, SerieModel, PersonData, Actor } from "../types";

export type VoiceActorResponse = {
  voiceActor: {
    id: number;
    firstname: string;
    lastname: string;
    bio: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    awards: string | null;
    years_active: string | null;
    social_media_links: Record<string, string> | null;
    profile_picture: string | null;
    voice_actor_name: string | null;
    user_voice_actor_links?: { id: string }[];
    work: {
      id: number;
      actor_id: number;
      dubbing_projects?: {
        content_id: number;
        content_type: string | null;
        studios?: {
          id: number;
          name: string;
          logo_url: string | null;
        } | null;
      };
      highlight: boolean | null;
      performance: string | null;
      source_id: number | null;
      status: string | null;
      suggestions: string | null;
      voice_actor_id: number | null;
    }[];
  };
  enhancedWorks?: EnhancedWorkItem[];
  medias: (MovieModel | SerieModel)[];
  potentialWikipediaUrl?: string | null;
  characterProfilePictures?: Array<{
    work_id?: number;
    profile_path?: string | null;
    image?: string | null;
    movieId?: number;
    showId?: number;
    name?: string;
  }>;
};

export type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: {
    id: number;
    actor_id: number;
    performance?: string | null;
    dubbing_projects?: {
      content_id: number;
      content_type: string | null;
      studios?: {
        id: number;
        name: string;
        logo_url: string | null;
      } | null;
    };
  };
  data: {
    character: string | undefined;
    characterImage?: string;
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
  characterProfilePictures: NonNullable<
    VoiceActorResponse["characterProfilePictures"]
  >;
  potentialWikipediaUrl: string | null;
  profilePicture?: string | null;
};

export function useVoiceActorData(
  initialData?: MaybeRef<VoiceActorDataPayload | null | undefined>,
) {
  const initial = unref(initialData);
  const voiceActor = ref<VoiceActorResponse["voiceActor"] | undefined>(
    initial?.voiceActor,
  );
  const enhancedWorksRef = ref<EnhancedWorkItem[]>(
    initial?.enhancedWorks || [],
  );
  const medias = ref<VoiceActorResponse["medias"]>(initial?.medias || []);
  const characterProfilePictures = ref<
    NonNullable<VoiceActorResponse["characterProfilePictures"]>
  >(initial?.characterProfilePictures || []);
  const profilePicture = ref<string | null | undefined>(
    initial?.profilePicture,
  );
  const loading = ref<boolean>(!initial);
  const searchQuery = ref("");
  const potentialWikipediaUrl = ref<string | null>(
    initial?.potentialWikipediaUrl || null,
  );

  watch(
    () => unref(initialData),
    (payload) => {
      if (payload) {
        voiceActor.value = payload.voiceActor;
        if (payload.enhancedWorks && payload.enhancedWorks.length > 0) {
          enhancedWorksRef.value = payload.enhancedWorks;
        }
        medias.value = payload.medias;
        characterProfilePictures.value = payload.characterProfilePictures;
        potentialWikipediaUrl.value = payload.potentialWikipediaUrl;
        profilePicture.value = payload.profilePicture;
        loading.value = false;
      }
    },
    { immediate: true, deep: true },
  );

  const loadVoiceActorData = async (id: string | number) => {
    loading.value = true;

    try {
      const payload = await fetchVoiceActorData(id);

      if (!payload) return;

      voiceActor.value = payload.voiceActor;
      if (payload.enhancedWorks && payload.enhancedWorks.length > 0) {
        enhancedWorksRef.value = payload.enhancedWorks;
      }
      medias.value = payload.medias;
      characterProfilePictures.value = payload.characterProfilePictures;
      potentialWikipediaUrl.value = payload.potentialWikipediaUrl;
      profilePicture.value = payload.profilePicture;
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

    const mediaMap = new Map<number, any>();
    for (const m of medias.value) {
      if (m && m.id) mediaMap.set(m.id, m);
    }

    const charPicMap = new Map<string, any>();
    for (const cp of characterProfilePictures.value) {
      const mediaId = cp.movieId || cp.showId;
      if (mediaId && cp.name) {
        charPicMap.set(`${mediaId}:${cp.name.toLowerCase()}`, cp);
      }
    }

    const result = voiceActor.value.work
      .map((work) => {
        const contentId = work.dubbing_projects?.content_id;
        if (!contentId) return null;

        const media = mediaMap.get(contentId);
        if (!media) return null;

        let actor: any;
        if (media.credits?.cast) {
          actor = media.credits.cast.find(
            (cast: { id: number }) => cast.id === work.actor_id,
          );
        }

        if (!actor) return null;

        const character = actor.character;
        let characterImage: string | undefined;

        if (character) {
          const pic = charPicMap.get(`${media.id}:${character.toLowerCase()}`);
          if (pic) {
            characterImage = pic.image || pic.profile_path || undefined;
          }
        }

        const data = {
          character,
          characterImage,
          actor: actorToPersonData(actor),
        };

        const sortDate =
          (media as { release_date?: string }).release_date ||
          (media as { first_air_date?: string }).first_air_date ||
          "9999-12-31";

        const titleStr =
          (media as { title?: string }).title ||
          (media as { name?: string }).name ||
          "";
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

      const title = (
        (item.media as { title?: string }).title ||
        (item.media as { name?: string }).name ||
        ""
      ).toLowerCase();
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
    characterProfilePictures,
    profilePicture,
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
