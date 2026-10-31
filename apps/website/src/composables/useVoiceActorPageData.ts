import type {
  EnhancedWorkItem,
  VoiceActorDataPayload,
  VoiceActorResponse,
} from "@app/shared-logic";

type VoiceActorPageWorkItem = Omit<EnhancedWorkItem, "media"> & {
  media_id: number;
  media_type: string;
};

type VoiceActorPageResponse = Omit<VoiceActorResponse, "enhancedWorks"> & {
  enhancedWorks?: VoiceActorPageWorkItem[];
  backdropPath?: string | null;
  workCount: number;
};

type VoiceActorPageDataPayload = VoiceActorDataPayload & { workCount: number };

export async function fetchVoiceActorPageData(
  id: string | number,
  lang?: string,
): Promise<VoiceActorPageDataPayload | null> {
  try {
    const response = await $fetch<VoiceActorPageResponse>(`/api/voice-actor/${id}`, {
      query: {
        ...(lang ? { lang } : {}),
        projection: "page",
      },
    });

    if (!response.voiceActor) return null;

    const mediaByKey = new Map<string, VoiceActorResponse["medias"][number]>();
    for (const media of response.medias) {
      mediaByKey.set(`${media.media_type}:${media.id}`, media);
    }

    const enhancedWorks: EnhancedWorkItem[] = [];
    for (const work of response.enhancedWorks ?? []) {
      const media = mediaByKey.get(`${work.media_type}:${work.media_id}`);
      if (!media) continue;
      enhancedWorks.push({
        work: work.work,
        media,
        data: work.data,
        sortDate: work.sortDate,
        searchText: work.searchText,
      });
    }

    return {
      voiceActor: response.voiceActor,
      workCount: response.workCount,
      enhancedWorks,
      medias: response.medias,
      characterProfilePictures: response.characterProfilePictures ?? [],
      potentialWikipediaUrl: response.potentialWikipediaUrl ?? null,
      profilePicture: response.voiceActor.profile_picture,
      backdropPath: response.backdropPath ?? null,
    };
  } catch (error) {
    console.error("fetchVoiceActorPageData error:", error);
    return null;
  }
}
