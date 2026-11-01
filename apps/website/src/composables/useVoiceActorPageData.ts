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
  workIndex?: VoiceActorPageWorkIndexItem[];
  pageMediaCacheSignature?: string | null;
  backdropPath?: string | null;
  workCount: number;
};

export type VoiceActorPageWorkIndexItem = {
  work: Pick<EnhancedWorkItem["work"], "id" | "actor_id" | "performance"> & {
    dubbing_projects: Pick<
      NonNullable<EnhancedWorkItem["work"]["dubbing_projects"]>,
      "content_type" | "studios"
    > | null;
  };
  data: {
    character: string | undefined;
    actor: Pick<EnhancedWorkItem["data"]["actor"], "id" | "name" | "profile_picture">;
  };
  sortDate: string;
  searchText: string;
};

type VoiceActorPageDataPayload = VoiceActorDataPayload & {
  workCount: number;
  workIndex: VoiceActorPageWorkIndexItem[];
  pageMediaCacheSignature: string | null;
};

export async function fetchVoiceActorPageData(
  id: string | number,
  lang?: string,
  page = 1,
): Promise<VoiceActorPageDataPayload | null> {
  try {
    const response = await $fetch<VoiceActorPageResponse>(`/api/voice-actor/${id}`, {
      query: {
        ...(lang ? { lang } : {}),
        projection: "page",
        page,
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
      workIndex: response.workIndex ?? [],
      pageMediaCacheSignature: response.pageMediaCacheSignature ?? null,
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

export async function fetchVoiceActorPageWorks(
  id: string | number,
  workIds: number[],
  cacheSignature: string | null,
  lang?: string,
  signal?: AbortSignal,
): Promise<{ enhancedWorks: EnhancedWorkItem[]; removedWorkIds: number[] } | null> {
  if (workIds.length === 0) return { enhancedWorks: [], removedWorkIds: [] };

  try {
    const response = await $fetch<{
      enhancedWorks: EnhancedWorkItem[];
      removedWorkIds: number[];
    }>(`/api/voice-actor/${id}/works`, {
      query: {
        ids: workIds.join(","),
        ...(cacheSignature ? { cacheSignature } : {}),
        ...(lang ? { lang } : {}),
      },
      signal,
    });
    return {
      enhancedWorks: response.enhancedWorks,
      removedWorkIds: response.removedWorkIds,
    };
  } catch (error) {
    if (signal?.aborted) return null;
    console.error("fetchVoiceActorPageWorks error:", error);
    return null;
  }
}
