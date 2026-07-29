import { ref, computed } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";
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
      };
      highlight: boolean | null;
      performance: string | null;
      source_id: number | null;
      status: string | null;
      suggestions: string | null;
      voice_actor_id: number | null;
    }[];
  };
  medias: (MovieModel | SerieModel)[];
  potentialWikipediaUrl?: string | null;
  characterProfilePictures?: Array<{ work_id?: number; profile_path?: string | null; image?: string | null; movieId?: number; showId?: number; name?: string }>;
  votes?: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
};

export type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: {
    id: number;
    actor_id: number;
    dubbing_projects?: { content_id: number; content_type: string | null };
  };
  data: {
    character: string | undefined;
    characterImage?: string;
    actor: PersonData<Actor>;
  };
  sortDate: string;
};

// Helper for mapping Actor to PersonData
function actorToPersonData(actor: { id: number; name?: string; character?: string; profile_path?: string | null; }): PersonData<Actor> {
  return {
    id: actor.id,
    name: actor.name,
    character: actor.character,
    profile_picture: actor.profile_path || undefined,
  };
}

export type VoiceActorDataPayload = {
  voiceActor?: VoiceActorResponse["voiceActor"];
  medias: VoiceActorResponse["medias"];
  characterProfilePictures: NonNullable<VoiceActorResponse["characterProfilePictures"]>;
  potentialWikipediaUrl: string | null;
  profilePicture?: string | null;
  votes?: VoiceActorResponse["votes"];
};

export async function fetchVoiceActorData(supabase: SupabaseClient, id: string | number): Promise<VoiceActorDataPayload | null> {
  const voiceActorResponseRaw = await supabase.functions.invoke("voice-actor", {
    body: { id },
  });

  const voiceActorResponse = (await voiceActorResponseRaw.data) as VoiceActorResponse;

  if (!voiceActorResponse || !voiceActorResponse.voiceActor) {
    console.error("voiceActorResponse is null");
    return null;
  }

  return {
    voiceActor: voiceActorResponse.voiceActor,
    medias: voiceActorResponse.medias || [],
    characterProfilePictures: voiceActorResponse.characterProfilePictures || [],
    potentialWikipediaUrl: voiceActorResponse.potentialWikipediaUrl || null,
    profilePicture: voiceActorResponse.voiceActor.profile_picture || null,
    votes: voiceActorResponse.votes
  };
}

export function useVoiceActorData(supabase: SupabaseClient, initialData?: VoiceActorDataPayload | null) {
  const voiceActor = ref<VoiceActorResponse["voiceActor"] | undefined>(initialData?.voiceActor);
  const medias = ref<VoiceActorResponse["medias"]>(initialData?.medias || []);
  const characterProfilePictures = ref<NonNullable<VoiceActorResponse["characterProfilePictures"]>>(initialData?.characterProfilePictures || []);
  const profilePicture = ref<string | null | undefined>(initialData?.profilePicture);
  const loading = ref<boolean>(!initialData);
  const searchQuery = ref("");
  const potentialWikipediaUrl = ref<string | null>(initialData?.potentialWikipediaUrl || null);
  
  // Votes that the component can consume or integrate into its own store
  const votes = ref<VoiceActorResponse["votes"]>(initialData?.votes);

  const loadVoiceActorData = async (id: string | number) => {
    loading.value = true;

    try {
      const payload = await fetchVoiceActorData(supabase, id);

      if (!payload) return;

      voiceActor.value = payload.voiceActor;
      medias.value = payload.medias;
      characterProfilePictures.value = payload.characterProfilePictures;
      potentialWikipediaUrl.value = payload.potentialWikipediaUrl;
      profilePicture.value = payload.profilePicture;
      votes.value = payload.votes;
    } catch (error) {
      console.error("Error fetching voice actor:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const baseEnhancedWork = computed<EnhancedWorkItem[]>(() => {
    if (!voiceActor.value?.work) {
      return [];
    }

    const result = voiceActor.value.work
      .map((work) => {
        const media = medias.value.find(
          (media: any) => media.id === work.dubbing_projects?.content_id,
        );

        if (!media) return null;

        if (!(media as { credits?: { cast?: Array<{ id: number; character: string; name?: string; profile_path?: string | null; }> } }).credits?.cast) {
          return null;
        }

        const actor = (media as { credits?: { cast?: Array<{ id: number; character: string; name?: string; profile_path?: string | null; }> } }).credits?.cast?.find(
          (cast: { id: number }) => cast.id === work.actor_id,
        );

        if (!actor) return null;

        const character = actor.character;
        let characterImage: string | undefined;

        if (characterProfilePictures.value.length > 0) {
          const pic = characterProfilePictures.value.find(
            (cp: any) =>
              (cp.movieId === media.id || cp.showId === media.id) &&
              cp.name &&
              character &&
              cp.name.toLowerCase() === character.toLowerCase(),
          );
          if (pic) {
            characterImage = pic.image || pic.profile_path || undefined;
          }
        }

        const data = {
          character,
          characterImage,
          actor: actorToPersonData(actor),
        };

        return {
          media,
          work,
          data,
          sortDate:
            (media as { release_date?: string }).release_date ||
            (media as { first_air_date?: string }).first_air_date ||
            "9999-12-31",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return result;
  });

  const enhancedWork = computed(() => {
    if (!baseEnhancedWork.value) return [];
    return [...baseEnhancedWork.value].sort((a, b) => {
      if (!a || !b) return 0;
      return a.sortDate > b.sortDate ? -1 : 1; // Newest first
    });
  });

  const filteredEnhancedWork = computed(() => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return enhancedWork.value;

    return enhancedWork.value.filter((item) => {
      const title = (
        (item.media as { title?: string }).title ||
        (item.media as { name?: string }).name ||
        ""
      ).toLowerCase();
      const character = (item.data.character || "").toLowerCase();
      const actorName = (item.data.actor?.name || "").toLowerCase();

      return (
        title.includes(query) ||
        character.includes(query) ||
        actorName.includes(query)
      );
    });
  });

  const isLinked = computed(() => {
    return (voiceActor.value?.user_voice_actor_links?.length ?? 0) > 0;
  });

  return {
    voiceActor,
    medias,
    characterProfilePictures,
    profilePicture,
    loading,
    searchQuery,
    potentialWikipediaUrl,
    votes,
    isLinked,
    baseEnhancedWork,
    enhancedWork,
    filteredEnhancedWork,
    loadVoiceActorData
  };
}
