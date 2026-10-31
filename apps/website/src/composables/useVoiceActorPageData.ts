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
};

export async function fetchVoiceActorPageData(
  id: string | number,
  lang?: string,
): Promise<VoiceActorDataPayload | null> {
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

    const enhancedWorks = (response.enhancedWorks ?? []).flatMap((work) => {
      const media = mediaByKey.get(`${work.media_type}:${work.media_id}`);
      return media ? [{ ...work, media }] : [];
    });

    return {
      voiceActor: response.voiceActor,
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
