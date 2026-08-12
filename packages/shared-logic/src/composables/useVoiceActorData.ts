import { ref, computed } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MovieDetailResponse,
  TVDetailResponse,
  GameDetailResponse,
  MovieMedia,
  TVMedia,
  GameMedia,
  PersonData,
  Actor,
} from "../types";

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
  medias: (MovieMedia | TVMedia | GameMedia)[];
  potentialWikipediaUrl?: string | null;
  characterProfilePictures?: Array<{
    work_id?: number;
    profile_path?: string | null;
    image?: string | null;
    movieId?: number;
    showId?: number;
    name?: string;
  }>;
  votes?: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
};

export type EnhancedWorkItem = {
  media: MovieMedia | TVMedia | GameMedia;
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
  };
  data: {
    character: string | undefined;
    characterImage?: string | null;
    actor?: PersonData<Actor>;
  };
  sortDate: string;
};

// Helper for mapping Actor to PersonData
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

function getMediaSortDate(media: MovieMedia | TVMedia | GameMedia): string {
  if (media.media_type === "movie") {
    return media.release_date || "";
  }
  if (media.media_type === "video_game") {
    return media.first_release_date ? String(media.first_release_date) : "";
  }
  return media.first_air_date || "";
}

export type VoiceActorDataPayload = {
  voiceActor?: VoiceActorResponse["voiceActor"];
  medias: VoiceActorResponse["medias"];
  characterProfilePictures: NonNullable<
    VoiceActorResponse["characterProfilePictures"]
  >;
  potentialWikipediaUrl: string | null;
  profilePicture?: string | null;
  votes?: VoiceActorResponse["votes"];
};

export async function fetchVoiceActorData(
  supabase: SupabaseClient,
  id: string | number,
): Promise<VoiceActorDataPayload | null> {
  const voiceActorResponseRaw = await supabase.functions.invoke("voice-actor", {
    body: { id },
  });

  const voiceActorResponse =
    (await voiceActorResponseRaw.data) as VoiceActorResponse;

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
    votes: voiceActorResponse.votes,
  };
}

export function useVoiceActorData(
  supabase: SupabaseClient,
  id: string | number,
) {
  const voiceActor = ref<VoiceActorResponse["voiceActor"] | null>(null);
  const medias = ref<VoiceActorResponse["medias"]>([]);
  const characterProfilePictures = ref<
    NonNullable<VoiceActorResponse["characterProfilePictures"]>
  >([]);
  const potentialWikipediaUrl = ref<string | null>(null);
  const profilePicture = ref<string | null>(null);
  const votes = ref<VoiceActorResponse["votes"] | undefined>(undefined);

  const loading = ref(true);
  const error = ref<string | null>(null);

  const enhancedWork = computed<EnhancedWorkItem[]>(() => {
    if (!voiceActor.value) return [];

    const works = voiceActor.value.work || [];
    const characterPics = characterProfilePictures.value;

    return works.map((work) => {
      // Find matching media from the medias array
      const media = medias.value.find(
        (m) =>
          m.id === work.dubbing_projects?.content_id &&
          (m.media_type === work.dubbing_projects?.content_type ||
            (work.dubbing_projects?.content_type === "tv" &&
              m.media_type === "tv") ||
            (work.dubbing_projects?.content_type === "movie" &&
              m.media_type === "movie") ||
            (work.dubbing_projects?.content_type === "video_game" &&
              m.media_type === "video_game")),
      );

      // Find character image from characterProfilePictures
      const characterPic = characterPics.find((cp) => cp.work_id === work.id);
      const characterImage =
        characterPic?.image ?? characterPic?.profile_path ?? null;

      // Find the original actor from TMDB credits
      const actor = media?.credits?.cast?.find((c) => c.id === work.actor_id);

      return {
        media: media!,
        work,
        data: {
          character: actor?.character,
          characterImage,
          actor: actor ? actorToPersonData(actor) : undefined,
        },
        sortDate: getMediaSortDate(media!),
      };
    });
  });

  const filteredWork = computed(() => {
    return (searchQuery: string) => {
      if (!searchQuery.trim()) return enhancedWork.value;

      const query = searchQuery.toLowerCase();
      return enhancedWork.value.filter((item) => {
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
    };
  });

  const isLinked = computed(() => {
    return (voiceActor.value?.user_voice_actor_links?.length ?? 0) > 0;
  });

  const load = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await fetchVoiceActorData(supabase, id);
      if (data) {
        voiceActor.value = data.voiceActor || null;
        medias.value = data.medias || [];
        characterProfilePictures.value = data.characterProfilePictures || [];
        potentialWikipediaUrl.value = data.potentialWikipediaUrl || null;
        profilePicture.value = data.profilePicture || null;
        votes.value = data.votes;
      }
    } catch (e) {
      error.value = "Failed to load voice actor data";
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    voiceActor,
    medias,
    characterProfilePictures,
    profilePicture,
    loading,
    error,
    enhancedWork,
    filteredWork,
    isLinked,
    load,
    potentialWikipediaUrl,
    votes,
  };
}
